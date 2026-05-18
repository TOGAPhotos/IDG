# Observation Log Feature Design

This document is the canonical branch documentation for `feat/spotter-log`.
The code uses the name `observation-log`; product discussions may also call it
`spotter-log`. Treat those as the same feature unless a future rename changes
the API surface.

The document is self-contained for future development. It covers the product
model, backend design, database shape, search contract, rollout plan, trade-offs,
and extension rules.

## Current Scope

The IDG backend now supports user-owned aircraft observation logs that can be
created directly, enriched with custom fields and tags, attached to an image,
submitted into the normal photo review queue, and linked back from accepted
gallery photos.

The branch adds these major capabilities:

- Observation log CRUD and public detail reads.
- Per-user custom field templates and typed field values.
- Per-user tags and tag search.
- A joined read model view, `observation_log_info`, for list, detail, search,
  and stats reads.
- Advanced `where`-tree search for frontend filter builders.
- Observation-log image upload and normalization to a max 1920 px JPEG.
- Upload from an observation log into the existing photo review queue.
- Automatic observation-log creation or linking when a queued photo is accepted.
- Aircraft information submissions for missing aircraft fields, with reviewer
  approval and queue gating.
- A Dev-first accepted-photo backfill script.
- Environment and Prisma tooling cleanup around `NODE_ENV`, Dev/Prod targeting,
  and startup safety.

This repo contains the backend implementation and contract. Frontend code should
integrate against the endpoints described below.

## File Map

Core feature files:

```text
src/handler/observationLog/index.ts
src/handler/observationLog/fields.ts
src/dto/observationLog.ts
src/handler/info/aircraftInfoSubmission.ts
src/dto/aircraftInfoSubmission.ts
src/router/index.ts
src/service/imageProcesser/index.ts
src/handler/queue/index.ts
src/handler/photo/cos.ts
script/backfillObservationLogs.ts
```

Database files:

```text
prisma/migrations/20260507000000_observation_log_system/migration.sql
prisma/migrations/20260516000000_observation_log_info_view/migration.sql
prisma/views/TOGAPhotos/observation_log_info.sql
prisma/schema.prisma
prisma.config.ts
```

Focused tests:

```text
src/test/observationLogSearch.test.ts
src/test/aircraftInfoSubmission.test.ts
src/test/weeklyPickHandler.test.ts
```

Related branch cleanup:

```text
src/config.ts
togaserver.config.cjs
vitest.setup.ts
package.json
example.env
```

## Product Model

An observation log is a user-owned record of a real-world aircraft sighting or
photo opportunity. The record can be useful even before it becomes a gallery
photo.

The feature deliberately separates three concepts:

- Observation log: The user's personal structured record.
- Queue photo: A normal submitted photo waiting for review in the existing
  `photo` table and queue flow.
- Accepted gallery photo: A reviewed `photo` row with status `ACCEPT`.

This separation lets the product support several paths:

- A user creates a text-only observation with registration and airport.
- A user creates an observation with an image, normalizes that image, and later
  submits it to the queue.
- A user uploads through the normal queue flow; when the photo is accepted, the
  system creates or links an observation log automatically.
- A user sees that aircraft details are missing and submits structured aircraft
  information for staff review before final gallery acceptance.

## Data Model

### `observation_log`

This is the write table. It stores one log row per observation.

Important columns:

```text
id
user_id
visibility
source
source_photo_id
queued_photo_id
observed_at
observed_date
airport_id
airline_id
ac_reg
ac_msn
ac_type
pic_type
location_text
note
exif
pending_info
metadata
image_raw_key
image_key
image_status
image_width
image_height
image_size
created_at
updated_at
deleted_at
```

`visibility` is currently:

```text
PRIVATE
PUBLIC
```

`source` is currently:

```text
MANUAL
QUICK_UPLOAD
ACCEPTED_PHOTO
```

`image_status` is currently:

```text
NONE
WAIT
UPLOAD
COMPLETE
ERROR
```

Uniqueness rules:

- `source_photo_id` is unique so one accepted gallery photo maps to at most one
  observation log.
- `queued_photo_id` is unique so one queue submission maps to at most one
  observation log.

Primary indexes:

- `(user_id, observed_at)` for default timeline listing.
- `(user_id, source)` for source filters.
- `(user_id, ac_reg)` for registration filters.
- `(user_id, airport_id)` and `(user_id, airline_id)` for structured filters.

### `observation_log_info`

This is the read view used by list, detail, search, and stats.

It joins:

- `observation_log` as the base row.
- `photo` for `queued_photo_status`.
- `airport` for airport display names and codes.
- `airline` for airline display names and codes.

The view keeps reads stable and avoids repeating the same airport/airline joins
inside every DTO method. Tags and custom fields are intentionally not included
in the view because joining them directly would multiply rows. They are attached
after base rows are fetched through `attachExtras()`.

The migration creates the view with:

```sql
CREATE OR REPLACE SQL SECURITY INVOKER VIEW `observation_log_info` AS ...
```

`SQL SECURITY INVOKER` is important for this repo because the view can otherwise
drift around definer permissions between local, Dev, and production databases.

### `observation_log_field`

This stores per-user custom field templates.

Supported `value_type` values:

```text
TEXT
NUMBER
DATE
BOOLEAN
SELECT
```

Fields are archived with `is_archived`; they are not physically deleted. This
keeps old log values readable while hiding the field from normal active field
lists.

### `observation_log_field_value`

This stores typed values for custom fields. The table has one row per
`(log_id, field_id)` and separate typed columns:

```text
text_value
number_value
date_value
bool_value
select_value
```

The design is intentionally not a single JSON blob. Typed columns make filtering
and indexing possible for common custom-field searches.

### `observation_log_tag` and `observation_log_tag_link`

Tags are per-user labels. The tag name is normalized by trimming whitespace,
collapsing internal whitespace, and limiting length to 60 characters.

The link table uses `(log_id, tag_id)` as the primary key.

### `aircraft_info_submission`

This table stores user-submitted aircraft information that staff can review.

Fields:

```text
id
create_user
status
reg
msn
ln
airline_id
air_type
remark
review_message
reviewer_id
created_at
updated_at
reviewed_at
is_delete
```

`status` is currently:

```text
WAITING
AVAILABLE
REJECT
```

The create path deduplicates pending submissions by `(create_user, reg)` while
`status = 'WAITING'` and `is_delete = false`.

## Validation Rules

The core log validation is:

1. `observedAt` is required and must parse as a valid date.
2. A log must have either:
   - an image, or
   - both a non-empty registration and a valid airport id.

This means an empty registration is allowed if the log has an image. It is not
allowed for image-less structured logs because those need enough data to be
useful.

There is no `title` field. Future work should not reintroduce title unless the
product decision changes. The current design treats the log as structured data
plus note text, not as a titled article.

## API Surface

All routes below are under the existing API router prefix, for example
`/api/v2`.

### Public Detail

```http
GET /observation-logs/:id
```

This route is available before the login middleware. It returns:

- Public logs to anonymous users.
- Public logs or the owner's own logs to authenticated users.

Private logs are only visible to the owner.

### Create Log

```http
POST /observation-logs
```

Requires login and valid user status.

Body example:

```json
{
  "visibility": "PRIVATE",
  "source": "MANUAL",
  "hasImage": true,
  "observedAt": "2026-05-17T14:30:00.000Z",
  "airportId": 1,
  "airlineId": 2,
  "acReg": "B-1234",
  "acMsn": "12345",
  "acType": "A320",
  "picType": "side",
  "locationText": "Terminal observation deck",
  "note": "Good light, left side taxi.",
  "exif": {},
  "pendingInfo": {},
  "metadata": {},
  "tags": ["night", "special"],
  "fields": [
    {
      "fieldId": 7,
      "value": 1000
    }
  ]
}
```

If `hasImage` is true, the log starts with:

```text
image_raw_key = observation-logs/{id}.raw
image_key = observation-logs/{id}.jpg
image_status = WAIT
```

Validation failures return `400`.

### List Logs

```http
GET /observation-logs?lastId=-1&take=20
```

Requires login.

Returns the current user's non-deleted logs. Default ordering is:

```text
observed_at DESC, id DESC
```

Pagination uses `lastId` as a cursor. For non-id ordering, the code fetches the
cursor row and compares both the sort value and `id` to avoid unstable paging
when multiple logs share the same observed time.

`take` is capped to 100.

### Update Log

```http
PUT /observation-logs/:id
```

Requires login and ownership.

Allowed update fields:

```text
visibility
observedAt
airportId
airlineId
acReg
acMsn
acType
picType
locationText
note
exif
pendingInfo
metadata
hasImage
tags
fields
```

If `observedAt` changes, `observed_date` is updated at the same time.

If `hasImage` is true, image keys are reset and image dimensions/size are
cleared so the new upload can be processed from a clean state.

### Delete Log

```http
DELETE /observation-logs/:id
```

Requires login and ownership.

This is a soft delete:

```sql
UPDATE observation_log SET deleted_at = NOW()
```

### Prepare Image Upload

```http
POST /observation-logs/:id/image-upload
```

Requires login and ownership.

The backend sets:

```text
rawKey = observation-logs/{id}.raw
imageKey = observation-logs/{id}.jpg
image_status = WAIT
```

It returns the COS upload URL generated from `photoBucket.getUploadUrl(rawKey)`.

### COS Upload Callback

```http
PUT /cos/observation-log?log_id={id}&status=available
```

Requires login.

When `status=available`, the backend marks the log image as uploading and sends
an image worker task:

```json
{
  "task": "T2-observationLogImageNormalize",
  "params": {
    "logId": 123,
    "inputFile": "observation-logs/123.raw",
    "outputFile": "observation-logs/123.jpg"
  }
}
```

The image worker:

1. Downloads the raw object.
2. Rotates using metadata.
3. Resizes inside `1920 x 1920` without enlargement.
4. Converts to JPEG at quality 90.
5. Uploads `observation-logs/{id}.jpg`.
6. Marks the log `COMPLETE` with width, height, and byte size.

On failure, the worker marks the log `ERROR`.

### Queue Upload From Observation Log

```http
POST /observation-logs/:id/queue-upload
```

Requires login, valid user status, ownership, and a completed observation-log
image.

Request body:

```json
{
  "queue": "NORMAL",
  "watermark": {
    "x": 20,
    "y": 20,
    "s": 0.2,
    "a": 0.35
  }
}
```

Accepted `queue` values are normalized to:

```text
NORMAL
PRIORITY
```

The path:

1. Reuses an existing `queued_photo_id` if the log was already queued.
2. Checks free queue capacity and priority capacity.
3. Creates a normal `photo` row using log metadata.
4. Copies `observation-logs/{id}.jpg` to `photos/{photoId}.raw`.
5. Marks the photo storage status as `UPLOAD`.
6. Sends the existing `T1-copyrightOverlay` image task.
7. Decrements user queue credit.
8. Links the observation log to `queued_photo_id` and sets source
   `QUICK_UPLOAD`.

If the object copy or worker enqueue setup fails after the `photo` row is
created, the code deletes the new photo row and rethrows the error.

### Search Logs

```http
POST /observation-logs/search
```

Requires login.

The backend only searches the current user's own non-deleted observation logs.

The old `filters` body is rejected. Always send `where`.

Success response shape:

```json
{
  "msg": "query ok",
  "data": {
    "logs": []
  }
}
```

Validation failures return `400` with the validation message.

Request type:

```ts
type SearchRequest = {
  where: QueryNode;
  sort?: {
    field:
      | "id"
      | "observedAt"
      | "createdAt"
      | "updatedAt"
      | "airportId"
      | "airlineId"
      | "acReg"
      | "acMsn"
      | "acType"
      | "picType"
      | "source"
      | "imageStatus"
      | "queuedPhotoStatus";
    direction: "asc" | "desc";
  };
  take?: number;
  lastId?: number;
};

type QueryNode =
  | { and: QueryNode[] }
  | { or: QueryNode[] }
  | { not: QueryNode }
  | FieldCondition;
```

Empty search:

```json
{
  "where": {},
  "take": 20
}
```

Limits:

- Max nesting depth is 8.
- Max query nodes is 80.
- Each node must contain exactly one of `and`, `or`, `not`, or `field`.
- Empty `or: []` returns no rows.
- Empty `and: []` adds no filter.
- `take` defaults to 20 and is capped at 100.

Normal fields:

| Field | Type | Description |
| --- | --- | --- |
| `id` | number | Log id |
| `observedAt` | date | Observation time |
| `createdAt` | date | Created time |
| `updatedAt` | date | Updated time |
| `airportId` | number | Airport id |
| `airportCode` | text | Matches IATA or ICAO |
| `airportName` | text | Matches Chinese or English airport name |
| `airlineId` | number | Airline id |
| `airlineCode` | text | Matches IATA or ICAO |
| `airlineName` | text | Matches Chinese or English airline name |
| `acReg` | text | Aircraft registration |
| `acMsn` | text | MSN |
| `acType` | text | Aircraft type |
| `picType` | text | Photo type |
| `locationText` | text | Free-form location text |
| `note` | text | Note |
| `visibility` | text | `PRIVATE` or `PUBLIC` |
| `source` | text | `MANUAL`, `QUICK_UPLOAD`, or `ACCEPTED_PHOTO` |
| `imageStatus` | text | `NONE`, `WAIT`, `UPLOAD`, `COMPLETE`, or `ERROR` |
| `queuedPhotoStatus` | text | Status of linked queued photo |

Special fields:

| Field | Description |
| --- | --- |
| `keyword` | Searches registration, MSN, type, photo type, location, note, airport names/codes, and airline names/codes |
| `tag` | Searches observation log tags |
| `customField` | Searches user-defined field values |
| `hasImage` | Presence filter for image |
| `hasGalleryPhoto` | Presence filter for accepted gallery source photo |
| `hasQueuedPhoto` | Presence filter for queued upload photo |

Text operators:

```ts
"eq" | "neq" | "in" | "notIn" | "contains" | "startsWith" | "isNull" | "isNotNull" | "exists" | "notExists"
```

Number/date operators:

```ts
"eq" | "neq" | "in" | "notIn" | "between" | "gt" | "gte" | "lt" | "lte" | "isNull" | "isNotNull" | "exists" | "notExists"
```

`keyword` operators:

```ts
"contains" | "startsWith" | "eq"
```

`tag` operators:

```ts
"any" | "all" | "in" | "notIn" | "eq" | "neq" | "exists" | "notExists"
```

Presence operators for `hasImage`, `hasGalleryPhoto`, and `hasQueuedPhoto`:

```ts
"eq" | "neq" | "exists" | "notExists" | "isNull" | "isNotNull"
```

For presence fields, `eq` expects a boolean `value`. If `value` is omitted,
`eq` means `true`.

Normal field condition:

```json
{
  "field": "acReg",
  "op": "contains",
  "value": "B-"
}
```

Date range:

```json
{
  "field": "observedAt",
  "op": "between",
  "value": ["2026-01-01", "2026-05-17"]
}
```

Number list:

```json
{
  "field": "airportId",
  "op": "in",
  "value": [1, 2, 3]
}
```

Presence:

```json
{
  "field": "hasImage",
  "op": "eq",
  "value": true
}
```

Tag match any:

```json
{
  "field": "tag",
  "op": "any",
  "value": ["night", "special"]
}
```

Tag match all:

```json
{
  "field": "tag",
  "op": "all",
  "value": ["night", "special"]
}
```

Custom field:

```json
{
  "field": "customField",
  "fieldId": 7,
  "valueType": "NUMBER",
  "op": "gte",
  "value": 1000
}
```

Custom field `valueType` must be one of:

```ts
"TEXT" | "NUMBER" | "DATE" | "BOOLEAN" | "SELECT"
```

Custom field value mapping:

| `valueType` | Search column behavior | Useful operators |
| --- | --- | --- |
| `TEXT` | Text value | `eq`, `contains`, `startsWith`, `in`, `notIn`, `exists`, `notExists` |
| `SELECT` | Selected option text | `eq`, `in`, `notIn`, `exists`, `notExists` |
| `NUMBER` | Numeric value | `eq`, `between`, `gt`, `gte`, `lt`, `lte`, `in`, `notIn` |
| `DATE` | Date value | `eq`, `between`, `gt`, `gte`, `lt`, `lte`, `in`, `notIn` |
| `BOOLEAN` | Boolean value | `eq`, `neq`, `in`, `notIn`, `exists`, `notExists` |

Search examples:

```json
{
  "where": {},
  "sort": {
    "field": "observedAt",
    "direction": "desc"
  },
  "take": 20
}
```

```json
{
  "where": {
    "field": "keyword",
    "op": "contains",
    "value": "B-1234"
  }
}
```

```json
{
  "where": {
    "and": [
      {
        "field": "airportCode",
        "op": "eq",
        "value": "PEK"
      },
      {
        "field": "observedAt",
        "op": "between",
        "value": ["2026-01-01", "2026-05-17"]
      },
      {
        "or": [
          {
            "field": "hasGalleryPhoto",
            "op": "eq",
            "value": true
          },
          {
            "field": "hasQueuedPhoto",
            "op": "eq",
            "value": true
          }
        ]
      }
    ]
  }
}
```

```json
{
  "where": {
    "and": [
      {
        "field": "tag",
        "op": "all",
        "value": ["night", "special"]
      },
      {
        "field": "customField",
        "fieldId": 7,
        "valueType": "NUMBER",
        "op": "gte",
        "value": 1000
      }
    ]
  },
  "sort": {
    "field": "id",
    "direction": "asc"
  },
  "lastId": 100,
  "take": 50
}
```

Common invalid requests:

```json
{
  "filters": {
    "tags": ["night"]
  }
}
```

This is invalid because `filters` is obsolete for search.

```json
{
  "where": {
    "field": "customField",
    "valueType": "NUMBER",
    "op": "gte",
    "value": 100
  }
}
```

This is invalid because `customField` requires `fieldId`.

### Stats

```http
POST /observation-logs/stats
```

Requires login.

Stats currently use a simpler `filters` object, not the new `where` tree. This
is intentional for the branch because stats grouping existed as a separate
read path.

Supported `groupBy` values:

```text
month
airport
airline
airtype
reg
source
field:{fieldId}
```

Response rows include:

```text
bucket
total
uniqueRegCount
firstObservedAt
lastObservedAt
```

Future work can migrate stats to the same `where` compiler if frontend stats
needs full advanced-filter parity.

### Field Templates

```http
GET /observation-log-fields?includeArchived=1
POST /observation-log-fields
PUT /observation-log-fields/:id
DELETE /observation-log-fields/:id
```

Requires login. Create requires valid user status.

Create body example:

```json
{
  "label": "Distance",
  "fieldKey": "distance",
  "valueType": "NUMBER",
  "unit": "m",
  "options": null
}
```

Delete archives the field by setting `is_archived = true`.

### Aircraft Information Submissions

```http
POST /aircraft-info-submissions
GET /aircraft-info-submissions?status=WAITING
PUT /aircraft-info-submissions/:id
```

Create requires login and valid user status.

List behavior:

- Staff can list all submissions.
- Non-staff users only list their own submissions.
- `status=ALL` returns all statuses.
- Default status is `WAITING`.

Review requires staff.

Create body:

```json
{
  "reg": "B-1234",
  "msn": "12345",
  "ln": "678",
  "airlineId": 2,
  "airType": "A320",
  "remark": "Submitted from observation log"
}
```

Review body:

```json
{
  "status": "AVAILABLE",
  "message": "Approved"
}
```

On approval, the backend upserts into `aircraft`.

For existing aircraft rows, approved submissions do not overwrite existing
fields with empty submitted values. The update uses `COALESCE(NULLIF(...), old)`
style logic for text fields and `COALESCE` for nullable numeric ids.

## Queue and Gallery Integration

### Queue Review Gate

When a screener opens a queue photo, the response includes:

```json
{
  "pendingAircraftInfoSubmission": null
}
```

or a pending submission object.

When finalizing an `ACCEPT`, the queue handler checks for a pending submission
for the same uploading user and registration. If one exists, final acceptance
returns `409` and includes the blocking submission.

This prevents gallery acceptance from racing ahead of aircraft-info review.

The pending-submission probe catches the missing-table case for
`aircraft_info_submission` and treats it as non-blocking. This keeps unrelated
queue paths usable before the production migration is applied. Other
aircraft-info routes still require the table.

### Accepted Photo Linking

After queue finalization, if the result is `ACCEPT`, the queue handler calls:

```ts
ObservationLog.createOrLinkFromAcceptedPhoto(queueId)
```

The method follows this order:

1. Load the accepted photo from `full_photo_info`.
2. If an observation log already exists by `queued_photo_id`, update it to
   source `ACCEPTED_PHOTO`, fill `source_photo_id`, set `image_key`, mark image
   complete, and fill empty aircraft/location fields from the accepted photo.
3. If an observation log already exists by `source_photo_id`, return it.
4. Otherwise create a new private observation log from the accepted photo.

The method logs and swallows failures at the queue-handler boundary so a log
creation problem does not reverse an already completed photo review decision.

## Backfill

The branch includes:

```bash
npm run backfill:observation-logs
```

The script intentionally loads `.env.development`, forces `NODE_ENV=development`,
and refuses to run unless the database name is exactly:

```text
TOGAPhotos_Dev
```

It reads accepted, non-deleted rows from `photo`, skips photos already linked by
`source_photo_id`, and creates or updates observation logs in batches.

Observed time rule:

```text
photo.photo_time || photo.upload_time
```

`photo_time` is the shooting date. `upload_time` is the upload timestamp. This
is deliberately not `screen_finished_time`.

The script is Dev-first because this repo's production workflow treats
production as the source of truth and refreshes Dev from production.

## Runtime and Environment Changes

The branch removes `RUNNING_ENV` usage and standardizes on `NODE_ENV`:

```text
production
development
test
```

Development startup is guarded. If `NODE_ENV=development`, the backend refuses
to start unless `DATABASE_URL` points to a database name ending with:

```text
_Dev
```

This prevents accidental development server writes against production-like
databases.

Prisma tooling now has explicit Dev and Prod commands:

```bash
npm run db:migrate:status:dev
npm run db:migrate:status:prod
npm run db:migrate:dev
npm run db:migrate:deploy:prod
```

`prisma.config.ts` reads:

```text
DATABASE_URL
SHADOW_DATABASE_URL
```

The PM2 config names the process from `NODE_ENV` and passes `NODE_ENV` into the
runtime environment.

The WAF mode selection remains environment-aware:

```text
BYPASS
MONITOR
BLOCK
```

If `WAF_MODE` is missing or unknown, production defaults to `BLOCK`; other
environments default to `MONITOR`.

## Database Rollout Plan

### Why this rollout is DB-first

The production database has historically been managed as DB-first:

1. Change production database schema manually.
2. Pull or mirror schema back into code.
3. Refresh Dev from production.

Because production does not have a reliable Prisma migration baseline, do not
treat this rollout as a normal Prisma-managed deploy by default.

Do not directly run:

```bash
npx prisma migrate deploy
```

unless the Prisma migration ledger has first been intentionally baselined and
verified for production.

The reason is the migration directory contains historical schema migrations,
including:

```text
20250712125808_init
```

Prisma may try to apply old initialization SQL against tables that already
exist in production.

### SQL files to execute

Execute only these new feature SQL files, in order:

```text
prisma/migrations/20260507000000_observation_log_system/migration.sql
prisma/migrations/20260516000000_observation_log_info_view/migration.sql
```

The first creates:

```text
observation_log
observation_log_field
observation_log_field_value
observation_log_tag
observation_log_tag_link
aircraft_info_submission
```

The second creates or replaces:

```text
observation_log_info
```

### Step 0: Freeze code and SQL

Record the exact commit being deployed:

```bash
git rev-parse HEAD
```

Confirm the feature SQL and schema files match that commit:

```bash
git status --short prisma/migrations/20260507000000_observation_log_system/migration.sql prisma/migrations/20260516000000_observation_log_info_view/migration.sql prisma/schema.prisma prisma/views/TOGAPhotos/observation_log_info.sql
```

Why: backend code, Prisma schema, SQL files, and view definition must describe
the same table shape.

### Step 1: Production read-only precheck

Before applying DDL, confirm the new objects do not already exist:

```sql
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name IN (
    'observation_log',
    'observation_log_field',
    'observation_log_field_value',
    'observation_log_tag',
    'observation_log_tag_link',
    'aircraft_info_submission',
    'observation_log_info'
  );
```

Expected result: no rows.

If any object exists, stop and compare structure. Do not blindly continue.

### Step 2: Backup production

Create a backup or cloud snapshot before DDL.

Example:

```bash
mysqldump --single-transaction --routines --triggers --events <database_name> > prod-before-observation-log.sql
```

Why: this branch mostly adds new objects, but production DDL still needs a
rollback point for wrong-database, permission, or partial-execution failures.

### Step 3: Rehearse against a production clone

Create a temporary database from current production, for example:

```text
TOGAPhotos_migration_rehearsal
```

Confirm core old tables exist:

```sql
SHOW TABLES LIKE 'photo';
SHOW TABLES LIKE 'user';
SHOW TABLES LIKE 'aircraft';
SHOW TABLES LIKE 'airport';
SHOW TABLES LIKE 'airline';
```

Then execute:

```bash
mysql <database_name> < prisma/migrations/20260507000000_observation_log_system/migration.sql
mysql <database_name> < prisma/migrations/20260516000000_observation_log_info_view/migration.sql
```

Why: Dev may be disposable and refreshed from production, but a rehearsal clone
tests the real current production shape plus this feature SQL.

### Step 4: Verify rehearsal schema

Run:

```sql
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name IN (
    'observation_log',
    'observation_log_field',
    'observation_log_field_value',
    'observation_log_tag',
    'observation_log_tag_link',
    'aircraft_info_submission',
    'observation_log_info'
  )
ORDER BY table_name;
```

Verify the view definition directly:

```sql
SELECT security_type, view_definition
FROM information_schema.views
WHERE table_schema = DATABASE()
  AND table_name = 'observation_log_info';
```

Expected:

- `security_type` is `INVOKER`.
- The view does not reference removed fields such as `title`.
- The view selects airport and airline display columns.

### Step 5: Run backend smoke checks against rehearsal

With the backend pointed at the rehearsal database, run:

```bash
npm run build
```

Then smoke the key API paths:

- Create a log with `observedAt` and image.
- Create a log with `observedAt`, `acReg`, and `airportId`.
- Confirm a log without image and without `(reg + airport)` fails.
- Prepare image upload.
- Search with `where: {}`.
- Search with a nested `and/or` condition.
- Create a custom field and save a custom value.
- Create tags and search by tag.
- Create an aircraft-info submission.

Why: the SQL can succeed while the app still fails due to view definition,
permissions, or DTO assumptions.

### Step 6: Apply production SQL

After rehearsal passes, apply the same two SQL files to production, in order:

```bash
mysql <production_database_name> < prisma/migrations/20260507000000_observation_log_system/migration.sql
mysql <production_database_name> < prisma/migrations/20260516000000_observation_log_info_view/migration.sql
```

Do not apply unrelated migrations during this step.

### Step 7: Verify production schema

Repeat the Step 4 schema and view checks on production.

Also run a minimal app-level read check after deployment:

```http
GET /api/v2/observation-logs/:id
```

for a known public log once one exists, and:

```http
POST /api/v2/observation-logs/search
```

with:

```json
{
  "where": {},
  "take": 1
}
```

for an authenticated user.

### Step 8: Deploy backend

Deploy the backend commit recorded in Step 0.

Confirm `NODE_ENV=production` and that production `DATABASE_URL` points to the
production database.

### Step 9: Dev refresh and optional backfill

After production structure is correct, allow the normal production-to-Dev sync
to refresh `TOGAPhotos_Dev`.

If historical accepted photos should appear in observation logs during
development validation, run:

```bash
npm run backfill:observation-logs
```

The script refuses to run unless it is pointed at `TOGAPhotos_Dev`.

### View drift repair

If `prisma migrate status` looks clean but runtime errors show a stale view,
inspect the real view:

```sql
SELECT security_type, view_definition
FROM information_schema.views
WHERE table_schema = DATABASE()
  AND table_name = 'observation_log_info';
```

If the view is stale, reapply only:

```bash
prisma db execute --file prisma/migrations/20260516000000_observation_log_info_view/migration.sql
```

against the intended database.

## Design Trade-offs

### One write table plus a read view

Trade-off: The write model stays small and direct, while the read model view
absorbs common joins.

Why this was chosen:

- Airport and airline display data is needed by list, detail, search, and stats.
- Repeating joins in every DTO method is easy to get wrong.
- A view gives the frontend a stable read shape without denormalizing data into
  the write table.

Cost:

- View drift is possible if production is changed manually.
- The view must be checked directly when migration status disagrees with runtime
  behavior.

### Tags and custom fields are attached outside the view

Trade-off: The view excludes tag and field-value joins.

Why this was chosen:

- Joining tags and field values directly would multiply rows.
- Pagination would become harder to reason about.
- `attachExtras()` keeps base log pagination stable.

Cost:

- Reads use extra queries after fetching base rows.
- Search still needs `EXISTS` subqueries for tag and custom-field filters.

### Typed custom fields instead of JSON-only metadata

Trade-off: Custom values use typed columns rather than only storing JSON.

Why this was chosen:

- Number, date, boolean, and select searches need real typed comparison.
- Indexes on `(field_id, number_value)`, `(field_id, date_value)`, and similar
  columns are possible.

Cost:

- The schema has more tables and mapping code.
- Adding a new custom field type requires DTO, schema, and search updates.

### Raw SQL in DTOs

Trade-off: `ObservationLog` and `AircraftInfoSubmission` use raw SQL through
Prisma rather than only generated Prisma Client methods.

Why this was chosen:

- The feature needs view reads, dynamic search compilation, `EXISTS` subqueries,
  and manual cursor conditions.
- Raw SQL gives precise control over generated queries and avoids awkward ORM
  shapes for user-built filter trees.

Cost:

- Query construction must be reviewed carefully.
- Every dynamic value must remain parameterized.
- Future schema changes must update SQL strings manually.

### Reuse existing photo queue pipeline

Trade-off: Observation-log queue upload creates a normal `photo` row and sends
the existing image-processing task instead of creating a parallel review system.

Why this was chosen:

- Review permissions, queue capacity, watermarking, accepted-photo state, and
  passing-rate updates already exist around `photo`.
- A parallel queue would duplicate business rules and create inconsistent
  gallery behavior.

Cost:

- Observation logs inherit some assumptions from the photo upload path.
- Queue upload requires a completed normalized observation-log image first.

### Raw plus normalized observation images

Trade-off: The system stores both:

```text
observation-logs/{id}.raw
observation-logs/{id}.jpg
```

Why this was chosen:

- The raw file preserves the upload source.
- The normalized JPEG gives predictable display and queue-submission behavior.
- The 1920 px cap limits storage and bandwidth for log images.

Cost:

- Image state is asynchronous.
- UI must handle `WAIT`, `UPLOAD`, `COMPLETE`, and `ERROR`.

### DB-first rollout instead of normal Prisma deploy

Trade-off: Production rollout applies only the feature SQL manually.

Why this was chosen:

- Production is not reliably Prisma-baselined.
- Running every migration in `prisma/migrations` could replay old schema setup
  against existing tables.

Cost:

- The migration ledger is not the only source of truth.
- Operators must verify real table and view definitions directly.

### Search replaces old filters without compatibility

Trade-off: `/observation-logs/search` rejects the old `filters` body.

Why this was chosen:

- The feature is pre-release enough that compatibility shims would add noise.
- One `where` contract is clearer for frontend implementation.

Cost:

- Any frontend using the old body must update immediately.
- Stats still has its own simpler filter path until deliberately migrated.

### Aircraft submission approval preserves existing fields

Trade-off: Approving a submission fills missing aircraft fields but does not
overwrite existing values with empty submitted values.

Why this was chosen:

- User-submitted missing-info forms often contain partial data.
- Empty values should not erase better existing aircraft data.

Cost:

- Reviewers cannot clear a field through this approval path.
- A separate staff aircraft edit flow is still needed for destructive cleanup.

## Future Development Guide

### Add a base observation-log field

Update all relevant places:

```text
prisma/schema.prisma
prisma/migrations/.../migration.sql or a new migration
prisma/views/TOGAPhotos/observation_log_info.sql
prisma/migrations/20260516000000_observation_log_info_view/migration.sql or a new view migration
src/dto/observationLog.ts parseLogRow()
src/dto/observationLog.ts create/update allowed fields
src/dto/observationLog.ts QUERY_FIELD_COLUMNS if searchable
src/dto/observationLog.ts SEARCH_ORDER_COLUMNS if sortable
tests for create/update/search behavior
```

Then regenerate Prisma Client if schema changed:

```bash
npm run db:generate
```

### Remove a base observation-log field

Do not remove it from only one layer. Check:

```text
src/dto/observationLog.ts
prisma/schema.prisma
prisma/views/TOGAPhotos/observation_log_info.sql
migration SQL
backfill script
search contract in this document
smoke tests
```

Also inspect the live view definition after deployment. A stale view can keep
referencing removed columns even when local files are correct.

### Add a search field

Update:

```text
QUERY_FIELD_COLUMNS
OBSERVATION_LOG_FEATURE.md search field table
src/test/observationLogSearch.test.ts
```

If the field comes from tags or custom fields, prefer an `EXISTS` subquery to
avoid row multiplication.

### Add a search operator

Update:

```text
normalizeQueryOperator()
compileSingleColumnCondition()
special-field compiler if needed
search tests
this document
```

Keep unsupported operator errors explicit. Silent fallback makes frontend bugs
hard to diagnose.

### Change image processing

Update both producer and consumer:

```text
src/handler/observationLog/index.ts
src/service/imageProcesser/index.ts
src/dto/observationLog.ts status update methods
```

Preserve these state transitions unless the UI is changed at the same time:

```text
WAIT -> UPLOAD -> COMPLETE
WAIT -> UPLOAD -> ERROR
```

### Change queue upload behavior

Use the existing queue and `photo` contracts unless the product explicitly wants
a separate review system.

Check:

```text
Photo.create()
User.updateById() queue counters
T1-copyrightOverlay task payload
ObservationLog.linkQueuedPhoto()
QueueHandler.processScreenResult()
ObservationLog.createOrLinkFromAcceptedPhoto()
```

### Change aircraft-info submission behavior

Check both sides:

```text
src/dto/aircraftInfoSubmission.ts
src/handler/info/aircraftInfoSubmission.ts
src/handler/queue/index.ts
```

If approval is allowed to overwrite existing aircraft fields, that is a product
change. Document it and add tests because the current design intentionally
preserves existing non-empty fields.

### Migrate stats to advanced search

Stats currently use `buildLogFilters()`. If full filter parity is required,
reuse the `where` compiler or extract it so stats and search cannot drift.

Watch for grouping queries. A search predicate can be reused, but `GROUP BY`
with custom fields may still need separate join handling.

## Verification

Recommended local checks after feature changes:

```bash
npm run build
./node_modules/.bin/vitest run src/test/observationLogSearch.test.ts
./node_modules/.bin/vitest run src/test/aircraftInfoSubmission.test.ts
./node_modules/.bin/vitest run src/test/queue.test.ts
```

When DB access is involved, confirm the target database first:

```bash
npm run db:migrate:status:dev
npm run db:migrate:status:prod
```

For view issues, do not rely only on Prisma migration status. Query
`information_schema.views` directly as described in the rollout section.

## Known Gotchas

- Code presence does not prove database rollout. The table/view must exist in
  the live database.
- `observation_log_info` can become stale if manually changed or if a migration
  ledger says applied while the view definition differs.
- `/observation-logs/search` rejects `filters`; send `where`.
- `stats` still uses `filters`; do not assume it accepts `where`.
- Development startup refuses databases not ending in `_Dev`.
- `backfill:observation-logs` refuses anything except `TOGAPhotos_Dev`.
- Missing `aircraft_info_submission` is tolerated only in the queue pending
  check. The submission APIs still need the table.
- Public detail reads should call `getVisible(id, req.token?.id ?? null)` so
  anonymous public reads keep working.
- `title` is intentionally absent.


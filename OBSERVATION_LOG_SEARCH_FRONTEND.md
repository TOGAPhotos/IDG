# Observation Log Search Frontend Contract

This document describes the backend contract for the observation log advanced search UI.

## Endpoint

`POST /api/v2/observation-logs/search`

Requires login. The backend only searches the current user's own non-deleted observation logs.

Success response:

```json
{
  "msg": "查询成功",
  "data": {
    "logs": []
  }
}
```

Validation failure response:

```json
{
  "msg": "请提供 where 查询条件"
}
```

The old `filters` request body is no longer supported. Always send `where`.

## Request Shape

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
  take?: number;   // default 20, max 100
  lastId?: number; // default omitted or -1
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

- Max nesting depth: 8.
- Max query nodes: 80.
- Each node must contain exactly one of `and`, `or`, `not`, or `field`.
- Empty `or: []` returns no rows. Empty `and: []` adds no filter.

## Fields

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
| `keyword` | Searches registration, MSN, type, photo type, location, note, airport names/codes, airline names/codes |
| `tag` | Searches observation log tags |
| `customField` | Searches user-defined field values |
| `hasImage` | Presence filter for image |
| `hasGalleryPhoto` | Presence filter for accepted gallery source photo |
| `hasQueuedPhoto` | Presence filter for queued upload photo |

## Operators

Use canonical operator names in frontend code.

Text fields:

```ts
"eq" | "neq" | "in" | "notIn" | "contains" | "startsWith" | "isNull" | "isNotNull" | "exists" | "notExists"
```

Number/date fields:

```ts
"eq" | "neq" | "in" | "notIn" | "between" | "gt" | "gte" | "lt" | "lte" | "isNull" | "isNotNull" | "exists" | "notExists"
```

`keyword`:

```ts
"contains" | "startsWith" | "eq"
```

`tag`:

```ts
"any" | "all" | "in" | "notIn" | "eq" | "neq" | "exists" | "notExists"
```

`hasImage`, `hasGalleryPhoto`, `hasQueuedPhoto`:

```ts
"eq" | "neq" | "exists" | "notExists" | "isNull" | "isNotNull"
```

For presence fields, `eq` expects a boolean `value`. If `value` is omitted, `eq` means `true`.

## Field Condition Shape

Normal field:

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

## Examples

### 1. Basic list, newest first

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

### 2. Keyword search

```json
{
  "where": {
    "field": "keyword",
    "op": "contains",
    "value": "JFK"
  },
  "take": 50
}
```

### 3. Multiple filters with nested OR

```json
{
  "where": {
    "and": [
      {
        "field": "observedAt",
        "op": "between",
        "value": ["2026-01-01", "2026-05-17"]
      },
      {
        "or": [
          {
            "field": "acReg",
            "op": "contains",
            "value": "B-"
          },
          {
            "field": "airlineCode",
            "op": "in",
            "value": ["CCA", "UAL"]
          }
        ]
      },
      {
        "field": "imageStatus",
        "op": "eq",
        "value": "COMPLETE"
      }
    ]
  },
  "sort": {
    "field": "observedAt",
    "direction": "desc"
  },
  "take": 50
}
```

### 4. Exclude failed image processing

```json
{
  "where": {
    "not": {
      "field": "imageStatus",
      "op": "eq",
      "value": "ERROR"
    }
  }
}
```

### 5. Tags and custom field

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
  "take": 50
}
```

### 6. Cursor pagination

Use the last returned log id as `lastId`.

```json
{
  "where": {
    "field": "airportCode",
    "op": "eq",
    "value": "JFK"
  },
  "sort": {
    "field": "observedAt",
    "direction": "desc"
  },
  "take": 20,
  "lastId": 12345
}
```

## Frontend Implementation Notes

- Build the query as a tree. Do not send empty condition objects except the root `{}` for "all logs".
- Use `and` for filters that must all apply.
- Use `or` for same-row alternatives, such as multiple search modes.
- Use `not` for exclusion instead of trying to manually invert every operator.
- Convert date picker values to ISO-like strings, for example `YYYY-MM-DD` or full ISO datetime.
- For free text fields, prefer `contains`.
- For exact enum/status fields, prefer `eq` or `in`.
- For tag chips, use `any` when any selected tag should match, and `all` when every selected tag must be present.
- For custom fields, keep the field metadata from `GET /api/v2/observation-log-fields`; send its `id` as `fieldId` and its `valueType`.
- If backend returns `400`, show `msg` directly. The backend message is already user/debug readable.

## Invalid Requests To Avoid

Old body:

```json
{
  "filters": {
    "tags": ["night"]
  }
}
```

Missing `where`:

```json
{
  "take": 20
}
```

Mixed node types:

```json
{
  "where": {
    "and": [],
    "field": "acReg",
    "op": "contains",
    "value": "B-"
  }
}
```

Missing custom field id:

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

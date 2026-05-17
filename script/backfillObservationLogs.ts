import dotenv from "dotenv";

const DEV_ENV_PATH = ".env.development";
const EXPECTED_DEV_DATABASE = "TOGAPhotos_Dev";

const envResult = dotenv.config({ path: DEV_ENV_PATH, override: true });
if (envResult.error) {
  throw new Error(`Failed to load ${DEV_ENV_PATH}: ${envResult.error.message}`);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(`DATABASE_URL is not configured in ${DEV_ENV_PATH}`);
}

function getDatabaseName(url: string) {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
  } catch {
    throw new Error(`DATABASE_URL in ${DEV_ENV_PATH} is not a valid database URL`);
  }
}

const databaseName = getDatabaseName(databaseUrl);
if (databaseName !== EXPECTED_DEV_DATABASE) {
  throw new Error(
    `Refusing to run observation log backfill against "${databaseName}". Expected "${EXPECTED_DEV_DATABASE}".`,
  );
}

process.env.NODE_ENV = "development";

const { prisma } = await import("../src/lib/prisma.js");

const configuredBatchSize = Number(process.env.OBSERVATION_LOG_BACKFILL_BATCH || 200);
const BATCH_SIZE = Number.isFinite(configuredBatchSize) && configuredBatchSize > 0
  ? Math.floor(configuredBatchSize)
  : 200;

type AcceptedPhotoRow = {
  id: number;
  upload_user_id: number;
  airport_id: number | null;
  airline_id: number | null;
  ac_reg: string | null;
  ac_msn: string | null;
  ac_type: string | null;
  pic_type: string | null;
  user_remark: string | null;
  photo_time: Date | string | null;
  upload_time: bigint | number | string | null;
  exif: unknown;
};

function dateFromInput(value?: string | Date | number | bigint | null) {
  if (value === undefined || value === null || value === "") return new Date();

  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === "bigint" || typeof value === "number") {
    date = new Date(Number(value));
  } else {
    const trimmed = value.trim();
    date = /^\d+$/.test(trimmed) ? new Date(Number(trimmed)) : new Date(trimmed);
  }

  return isNaN(date.getTime()) ? new Date() : date;
}

function mysqlDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function jsonValue(value: unknown) {
  if (value === undefined) return null;
  return JSON.stringify(value);
}

async function createOrLinkFromAcceptedPhoto(photoId: number) {
  const photoRows = await prisma.$queryRawUnsafe<AcceptedPhotoRow[]>(
    `SELECT id, upload_user_id, airport_id, airline_id, ac_reg, ac_msn, ac_type,
            pic_type, user_remark, photo_time, upload_time, exif
     FROM photo
     WHERE id = ?
       AND status = 'ACCEPT'
       AND COALESCE(is_delete, false) = false
     LIMIT 1`,
    photoId,
  );
  const photo = photoRows[0];
  if (!photo) return false;

  const existingBySource = await prisma.$queryRawUnsafe<{ id: number }[]>(
    `SELECT id FROM observation_log
     WHERE source_photo_id = ?
     LIMIT 1`,
    photoId,
  );
  if (existingBySource[0]) return false;

  const existingByQueued = await prisma.$queryRawUnsafe<{ id: number }[]>(
    `SELECT id FROM observation_log
     WHERE queued_photo_id = ? AND deleted_at IS NULL
     LIMIT 1`,
    photoId,
  );
  if (existingByQueued[0]) {
    await prisma.$executeRawUnsafe(
      `UPDATE observation_log
       SET source = 'ACCEPTED_PHOTO',
           source_photo_id = ?,
           image_key = ?,
           image_status = 'COMPLETE',
           airport_id = COALESCE(airport_id, ?),
           airline_id = COALESCE(airline_id, ?),
           ac_reg = COALESCE(ac_reg, ?),
           ac_msn = COALESCE(ac_msn, ?),
           ac_type = COALESCE(ac_type, ?),
           pic_type = COALESCE(pic_type, ?),
           exif = COALESCE(exif, ?)
       WHERE id = ?`,
      photoId,
      `photos/${photoId}.jpg`,
      photo.airport_id,
      photo.airline_id,
      photo.ac_reg,
      photo.ac_msn,
      photo.ac_type,
      photo.pic_type,
      jsonValue(photo.exif),
      existingByQueued[0].id,
    );
    return true;
  }

  const observedAt = dateFromInput(photo.photo_time || photo.upload_time);
  await prisma.$executeRawUnsafe(
    `INSERT INTO observation_log
      (user_id, visibility, source, source_photo_id, observed_at, observed_date,
       airport_id, airline_id, ac_reg, ac_msn, ac_type, pic_type, note, exif, image_key, image_status)
     VALUES (?, 'PRIVATE', 'ACCEPTED_PHOTO', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETE')`,
    photo.upload_user_id,
    photoId,
    observedAt,
    mysqlDate(observedAt),
    photo.airport_id,
    photo.airline_id,
    photo.ac_reg,
    photo.ac_msn,
    photo.ac_type,
    photo.pic_type,
    photo.user_remark,
    jsonValue(photo.exif),
    `photos/${photoId}.jpg`,
  );
  return true;
}

async function main() {
  let lastId = 0;
  let createdOrLinked = 0;

  console.log(`Observation log backfill using ${databaseName} from ${DEV_ENV_PATH}`);

  while (true) {
    const rows = await prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT p.id
       FROM photo p
       LEFT JOIN observation_log ol ON ol.source_photo_id = p.id
       WHERE p.id > ?
         AND p.status = 'ACCEPT'
         AND COALESCE(p.is_delete, false) = false
         AND ol.id IS NULL
       ORDER BY p.id ASC
       LIMIT ?`,
      lastId,
      BATCH_SIZE,
    );
    if (rows.length === 0) break;
    for (const row of rows) {
      lastId = row.id;
      const createdOrUpdated = await createOrLinkFromAcceptedPhoto(row.id);
      if (createdOrUpdated) createdOrLinked++;
    }
    console.log(`Backfilled through photo ${lastId}, total ${createdOrLinked}`);
  }

  console.log(`Observation log backfill done, total ${createdOrLinked}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import "dotenv/config";
import ObservationLog from "../src/dto/observationLog.js";
import { prisma } from "../src/lib/prisma.js";

const BATCH_SIZE = Number(process.env.OBSERVATION_LOG_BACKFILL_BATCH || 200);

async function main() {
  let lastId = 0;
  let createdOrLinked = 0;

  while (true) {
    const rows = await prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT ap.id
       FROM accept_photo ap
       LEFT JOIN observation_log ol ON ol.source_photo_id = ap.id AND ol.deleted_at IS NULL
       WHERE ap.id > ? AND ol.id IS NULL
       ORDER BY ap.id ASC
       LIMIT ?`,
      lastId,
      BATCH_SIZE,
    );
    if (rows.length === 0) break;
    for (const row of rows) {
      lastId = row.id;
      const log = await ObservationLog.createOrLinkFromAcceptedPhoto(row.id);
      if (log) createdOrLinked++;
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

import { PrismaClient } from "@prisma/client";
import Log from "../../components/loger.js";
const prisma = new PrismaClient();

export async function tallySCVote() {
  Log.info("Start tally SC vote");
  const SCVotes = await prisma.vote_list.findMany({
    where: {
      status: "IN_PROGRESS",
      end: { lte: Date.now() },
      type: "SC",
      is_delete: false,
    },
  });
  if (SCVotes.length === 0) {
    return Log.info("No SCVote event need to process");
  }
  await prisma.$executeRawUnsafe(`
      UPDATE vote_list
      JOIN photo p on vote_list.photo_id = p.id
      SET vote_list.status = 'END',
        tally = (
            SELECT sum(tally)
            FROM vote_record
            WHERE vote_event = vote_list.id
        ),
        p.pic_type = IF(
                (SELECT sum(tally)
                         FROM vote_record
                         WHERE vote_event = vote_list.id) > 0,
                CONCAT_WS(',',NULLIF(pic_type,''), 'ScreenerChoice'),
                pic_type)
      WHERE vote_list.status = 'IN PROGRESS'
        AND vote_list.id IN (${SCVotes.map((v) => v.id).join(",")})
        AND p.id = vote_list.photo_id;
  `);
  Log.info(`SC vote tally finished updated:${SCVotes.length}`);
}

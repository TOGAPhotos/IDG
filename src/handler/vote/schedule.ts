import { PrismaClient } from "@prisma/client";
import Log from "../../components/loger.js";
import Photo from "@/dto/photo.js";
const prisma = new PrismaClient();

export async function tallySCVote() {
  Log.info("SC投票结算");
  const SCVotes = await prisma.vote_list.findMany({
    where: {
      status: "IN_PROGRESS",
      end: { lte: Date.now() },
      type: "SC",
      is_delete: false,
    },
  });
  if (SCVotes.length === 0) {
    return Log.info("没有需要结算的SC投票");
  }
  await prisma.$executeRawUnsafe(`
      UPDATE TOGAPhotos_v2.vote_list
      JOIN TOGAPhotos_v2.photo p on vote_list.photo_id = p.id
      SET vote_list.status = 'END',
        tally = (
            SELECT sum(tally)
            FROM TOGAPhotos_v2.vote_record
            WHERE vote_event = TOGAPhotos_v2.vote_list.id
        ),
        p.pic_type = IF(
                (SELECT sum(tally)
                         FROM TOGAPhotos_v2.vote_record
                         WHERE vote_event = TOGAPhotos_v2.vote_list.id) > 0,
                CONCAT_WS(',',pic_type, 'ScreenerChoice'),
                1)
      WHERE vote_list.status = 'IN PROGRESS'
        AND end < (UNIX_TIMESTAMP() * 1000)
        AND p.id = vote_list.photo_id;
  `);
  Log.info("SC投票结算完成");
  // 结算完成后，获取SC图片，准备发送邮件
  // await prisma.$queryRawUnsafe(`
  //     SELECT p.id,p.upload_user_id,user_email
  //     FROM TOGAPhotos_v2.photo p
  //            JOIN TOGAPhotos_v2.user ON upload_user_id = user.id
  //     WHERE p.id IN (
  //       SELECT photo_id
  //       FROM TOGAPhotos_v2.vote_list
  //       WHERE id IN (${SCVotes.map((v) => v.id).join(",")})
  //         AND tally > 0
  //     )
  // `);
}

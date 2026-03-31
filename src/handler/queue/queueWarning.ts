import { PrismaClient } from "@prisma/client";
import MailTemp from "../../service/mail/mailTemp.js";
import bell from "../../components/bell.js";
import Log from "../../components/loger.js";

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

export async function QueueWarningNotice() {
  const prisma = new PrismaClient();

  const allUnreviewedInQueue = await prisma.queue_photo.findMany({
    where: {
      screener_1: null,
      upload_time: { not: null },
    },
    select: {
      id: true,
      ac_reg: true,
      airline_cn: true,
      airline_en: true,
      username: true,
      upload_time: true,
    },
  });

  const threshold = BigInt(Date.now() - FIVE_DAYS_MS);
  const stalePhotos = allUnreviewedInQueue
    .filter((p) => p.upload_time !== null && p.upload_time < threshold)
    .map((p) => ({
      id: p.id,
      ac_reg: p.ac_reg ?? "",
      airline: p.airline_cn || p.airline_en || "未知",
      username: p.username ?? "未知",
      daysInQueue: Math.floor((Date.now() - Number(p.upload_time)) / (24 * 60 * 60 * 1000)),
    }));

  if (stalePhotos.length === 0) {
    return;
  }

  const recipients = await prisma.user.findMany({
    where: {
      role: { in: ["SCREENER_2", "ADMIN"] },
      is_deleted: false,
    },
    select: {
      user_email: true,
      username: true,
    },
  });

  Log.info(`QueueWarningNotice: Found ${recipients.join(", ")} as recipients for ${stalePhotos.length} stale photos`);

  recipients.push({ user_email: "admin@togaphotos.com", username: "Admin" });

  const sendResults = await Promise.allSettled(
    recipients
      .filter((u) => u.user_email && u.user_email.endsWith("@togaphotos.com"))
      .map((u) =>
        MailTemp.QueueWarning(u.user_email!, {
          count: stalePhotos.length,
          photos: stalePhotos,
        })
      )
  );

  const failCount = sendResults.filter((r) => r.status === "rejected").length;
  if (failCount > 0) {
    Log.error(`QueueWarningNotice: ${failCount} email(s) failed to enqueue`);
  }

  Log.info(`QueueWarningNotice: ${stalePhotos.length} stale photo(s), notified ${recipients.length - failCount} screener(s)`);

  await bell(
    "审核队列积压提醒",
    `当前有 ${stalePhotos.length} 张照片在队列中超过5天未审核，已通知 ${recipients.length - failCount} 位审核员。`
  );
}

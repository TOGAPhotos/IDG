import nodeSchedule from "node-schedule";

import { SendEmail } from "./send.js";
import { EMAIL_HOUR_LIMIT } from "./config.js";

import MessageQueueConsumer from "../messageQueue/consume.js";
import { Counter } from "../../components/counter.js";
import Log from "../../components/loger.js";
import MailTemp from "./mailTemp.js";

const HourLimit = Counter();

// await MailTemp.ServerStatusNotice('davidyan003@gmail.com','邮件服务','已启动')
const emailQueue = new MessageQueueConsumer("email");

nodeSchedule.scheduleJob("0 * * * *", async () => {
  HourLimit.reset();
  await emailQueue.restart();
});

await emailQueue.consume(async (msg) => {
  if (HourLimit.get() >= EMAIL_HOUR_LIMIT) {
    await emailQueue.cancel();
    throw new Error();
  }
  HourLimit.add();

  let { sender, receiver, subject, template, content }: EmailFormat =
    JSON.parse(msg.content.toString());
  Log.info(
    `Email Record\nSender:${sender},\nReceiver:${receiver}\ncontent:${content}\n`,
  );
  const result = await SendEmail(sender, receiver, subject, template, content);
  Log.info(JSON.stringify(result));
});

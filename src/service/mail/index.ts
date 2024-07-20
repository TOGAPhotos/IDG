import nodeSchedule from "node-schedule";

import {SendEmail} from "./send.js";
import {EMAIL_HOUR_LIMIT} from "./config.js";

import MessageQueueConsumer from "../messageQueue/consume.js";
import {Counter} from "../../components/counter.js";
import Log from "../../components/loger.js";
import MailTemp from "./mailTemp.js";

const HourLimit = Counter()

// await MailTemp.ServerStatusNotice('davidyan003@gmail.com','邮件服务','已启动')
const emailQueue = new MessageQueueConsumer('email');

const TimerRule_1H = new nodeSchedule.RecurrenceRule();
TimerRule_1H.hour = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
TimerRule_1H.minute = 0
TimerRule_1H.second = 0

nodeSchedule.scheduleJob(TimerRule_1H, async ()=>{
    HourLimit.reset();
    await emailQueue.restart();
});

await emailQueue.consume(async (msg)=>{

    if(HourLimit.get() >= EMAIL_HOUR_LIMIT){
        await emailQueue.cancel();
        throw new Error()
    }
    HourLimit.add();

    let { sender,receiver,subject,template,content, }:EmailFormat = JSON.parse(msg.content.toString())
    Log.info(`Email Record\nSender:${sender},\nReceiver:${receiver}\ncontent:${content}\n`);
    const result = await SendEmail(sender,receiver,subject,template,content);
    Log.info(JSON.stringify(result));

});


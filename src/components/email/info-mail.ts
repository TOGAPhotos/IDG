import { SendEmail } from "./send.js";
import MessageQueueProducer from "../mq/producer.js";
import bell from "../bell.js";
const emailQueue = new MessageQueueProducer('email');

export async function SendInfoReviewNoticeEmail(emailAddr:string,result:string,cn_name:string,icao:string,iata='—'){
    if (iata === null){
        iata = '-';
    }
    if (iata.length === 0){
        iata = '—'
    }
    let email:EmailFormat = {
        sender: "TO/GA PHOTOS 数据管理团队 <DataManagementTeam@togaphotos.com>",
        receiver: emailAddr,
        subject: '[TO/GA Photos] 数据库补充信息审核结果',
        template: `toga_photos_add_info_${result}`,
        content: JSON.stringify({cn_name:cn_name,iata:iata,icao:icao})
    }
    await emailQueue.send(JSON.stringify(email));
    console.log('已将邮件添加到队列邮件')
}


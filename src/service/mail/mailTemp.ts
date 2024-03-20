import MessageQueueProducer from "../messageQueue/producer.js";
import Time from "../../components/time.js";

export default class MailTemp{
    static emailQueue = new MessageQueueProducer('email');

    static async ServerStatusNotice(emailAddr:string,serverName:string,status:string){
        let email:EmailFormat = {
            sender: "TO/GA PHOTOS 服务状态更新 <StatusUpdate@Togaphotos.com>",
            receiver: emailAddr,
            subject: `[TO/GA Photos] ${serverName} 服务状态更新`,
            template: null,
            content: `${serverName}于${Time.getUTCTime()}状态更新为${status}`
        }

        await this.emailQueue.send(JSON.stringify(email));
    }

    static async InfoReviewNotice(emailAddr:string,result:string,cn_name:string,icao:string,iata:string){

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

        await this.emailQueue.send(JSON.stringify(email));
    }
}
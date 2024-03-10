import MessageQueueProducer from "../messageQueue/producer.js";

export default class MailTemp{
    static emailQueue = new MessageQueueProducer('email');
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
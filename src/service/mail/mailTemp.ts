import MessageQueueProducer from "../messageQueue/producer.js";
import Time from "../../components/time.js";

export default class MailTemp {
    static emailQueue = new MessageQueueProducer('email');

    static async ServerStatusNotice(emailAddr: string, serverName: string, status: string) {
        let email: EmailFormat = {
            sender: "TOGAPhotos 服务状态更新 <StatusUpdate@Togaphotos.com>",
            receiver: emailAddr,
            subject: `[TO/GA Photos] ${serverName} 服务状态更新`,
            template: null,
            content: `${serverName}于${Time.getUTCTime()}状态更新为${status}`
        }

        await MailTemp.emailQueue.send(JSON.stringify(email));
    }

    static async InfoReviewNotice(emailAddr: string, result: string, cn_name: string, icao: string, iata: string) {

        switch (result) {
            case 'REJECT':
                result = 'reject';
                break;
            case 'AVAILABLE':
                result = 'accept';
                break;
        }

        if (iata.length === 0) {
            iata = '—'
        }

        const email: EmailFormat = {
            sender: "TOGAPhotos 数据管理团队 <DataManagementTeam@togaphotos.com>",
            receiver: emailAddr,
            subject: '[TO/GA Photos] 数据库补充信息审核结果',
            template: `toga_photos_add_info_${result}`,
            content: JSON.stringify({ cn_name: cn_name, iata: iata, icao: icao })
        }

        await MailTemp.emailQueue.send(JSON.stringify(email));
    }

    static async DirectMessageNotice(emailAddr: string, {
        photo_info,
        content,
        sender_name,
        receiver_name,
        contact_info
    }: {
        sender_name: string,
        receiver_name: string,
        contact_info: string,
        photo_info: string,
        content: string
    }) {
        const email: EmailFormat = {
            sender: "TOGAPhotos 消息机器人<no-replay@togaphotos.com>",
            receiver: emailAddr,
            subject: '[TO/GA Photos] 你有一条新的私信',
            template: 'togaphotos_directmessage_notice',
            content: JSON.stringify({
                sender_name: sender_name,
                receiver_name: receiver_name,
                contact_info: contact_info,
                photo_info: photo_info,
                content: content
            })
        }
        await MailTemp.emailQueue.send(JSON.stringify(email));
    }

}
import MessageQueueProducer from "../messageQueue/producer.js";
import Time from "../../components/time.js";
import * as fs from "node:fs";
import * as path from "node:path";
import handlebars from "handlebars";
import Log from "../../components/loger.js";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class MailTemp {
  static emailQueue = new MessageQueueProducer("email");

  private static renderHTMLTemplate(templateName: string, data: any) {
    const templatePath = path.join(__dirname, '../../../static/mailTemp', `${templateName}.hbs`);
    const templateSource = fs.readFileSync(templatePath, "utf8");
    const template = handlebars.compile(templateSource);
    return template(data);
  }

  static async ServerStatusNotice(
    emailAddr: string,
    serverName: string,
    status: string,
  ) {
    let email: EmailFormat = {
      sender: "TOGAPhotos 服务状态更新 <StatusUpdate@Togaphotos.com>",
      receiver: emailAddr,
      subject: `[TOGAPhotos] ${serverName} 服务状态更新`,
      template: null,
      content: `${serverName}于${Time.getUTCTime()}状态更新为${status}`,
    };

    await MailTemp.emailQueue.send(JSON.stringify(email));
  }

  static async InfoReviewNotice(
    emailAddr: string,
    result: string,
    cn_name: string,
    icao: string,
    iata: string,
  ) {
    switch (result) {
      case "REJECT":
        result = "reject";
        break;
      case "AVAILABLE":
        result = "accept";
        break;
    }

    if (iata.length === 0) {
      iata = "—";
    }

    const email: EmailFormat = {
      sender: "TOGAPhotos 数据管理团队 <DataManagementTeam@togaphotos.com>",
      receiver: emailAddr,
      subject: "[TOGAPhotos] 数据库补充信息审核结果",
      template: `toga_photos_add_info_${result}`,
      content: JSON.stringify({ cn_name: cn_name, iata: iata, icao: icao }),
    };

    await MailTemp.emailQueue.send(JSON.stringify(email));
  }

  static async DirectMessageNotice(
    emailAddr: string,
    {
      photo_info,
      content,
      sender_name,
      receiver_name,
      contact_info,
    }: {
      sender_name: string;
      receiver_name: string;
      contact_info: string;
      photo_info: string;
      content: string;
    },
  ) {
    const email: EmailFormat = {
      sender: "TOGAPhotos 消息机器人<no-reply@togaphotos.com>",
      receiver: emailAddr,
      subject: "[TOGAPhotos] 你有一条新的私信",
      template: "togaphotos_directmessage_notice",
      content: JSON.stringify({
        sender_name: sender_name,
        receiver_name: receiver_name,
        contact_info: contact_info,
        photo_info: photo_info,
        content: content,
      }),
    };
    await MailTemp.emailQueue.send(JSON.stringify(email));
  }

  static async ScreeningResultNotice(
    emailAddr: string,
    {
      username,
      photoList,
    }:{
      username: string;
      photoList: {id: number; ac_reg: string; airline: string; status: string,reason:string}[];
    },
  ){
    const results = photoList.map(photo => {
      return {
        id: photo.id,
        ac_reg: photo.ac_reg,
        airline: photo.airline,
        accept: photo.status.toLowerCase() === "accept",
        reject: photo.status.toLowerCase() === "reject",
        reason: photo.reason
      }
    });
    const email: EmailFormat = {
      sender: "TOGAPhotos 消息机器人<no-reply@togaphotos.com>",
      receiver: emailAddr,
      subject: "[TOGAPhotos] 图片审核结果通知",
      template: null,
      content: MailTemp.renderHTMLTemplate("screeningResult",{username, results})
    }
    await MailTemp.emailQueue.send(JSON.stringify(email));
  }
}

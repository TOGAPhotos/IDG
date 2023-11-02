import FormData from 'form-data';
import Mailgun from 'mailgun.js';
import { MailGunConnParams } from "../../config.js";
import { Counter } from '../counter.js';
import { Logger } from '../loger.js';

// @ts-ignore
const mg = new Mailgun(FormData);
const mailGunSession = await mg.client(MailGunConnParams);

export let HourLimit = Counter()

export async function SendEmail(sender:string,receiver:string,subject:string,template:string|null,content:object):Promise<void>{

    HourLimit.add();

    let contentStr = JSON.stringify(content);
    Logger.info(`Email Record\nSender:${sender},\nReceiver:${receiver}\ncontent:${content}\n`)

    if (Object.keys(content).length === 0) {
        await mailGunSession.messages.create('togaphotos.com', {
            from: sender,
            to: receiver,
            subject: subject,
            template: template
        });
    } else {
        await mailGunSession.messages.create('togaphotos.com', {
            from: sender,
            to: receiver,
            subject: subject,
            template: template,
            'h:X-Mailgun-Variables': contentStr,
        });
    }

}
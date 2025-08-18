import FormData from "form-data";
import Mailgun, { MessagesSendResult } from "mailgun.js";
import { MailGunConnParams } from "./config.js";
import { EMAIL_DOMAIN } from "./config.js";

// @ts-ignore
const mg = new Mailgun(FormData);
const mailGunSession = await mg.client(MailGunConnParams);

export async function SendEmail(
  sender: string,
  receiver: string,
  subject: string,
  template: string | null,
  content: string | null,
): Promise<MessagesSendResult> {
  if (template === null && content !== null) {
    return await mailGunSession.messages.create(EMAIL_DOMAIN, {
      from: sender,
      to: receiver,
      subject: subject,
      text: content,
    });
  }
  if (content === null && template !== null) {
    return await mailGunSession.messages.create(EMAIL_DOMAIN, {
      from: sender,
      to: receiver,
      subject: subject,
      template: template,
    });
  }
  if (content !== null && template !== null) {
    return await mailGunSession.messages.create(EMAIL_DOMAIN, {
      from: sender,
      to: receiver,
      subject: subject,
      template: template,
      "h:X-Mailgun-Variables": content,
    });
  }
  throw new Error(`参数错误`);
}

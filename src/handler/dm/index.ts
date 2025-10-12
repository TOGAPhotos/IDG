import type { Request, Response } from "express";

import Log from "../../components/loger.js";
import { DirectMessage } from "../../dto/directMessage.js";
import { HTTP_STATUS } from "../../types/http_code.js";
import MailTemp from "../../service/mail/mailTemp.js";
import User from "../../dto/user.js";
import Photo from "../../dto/photo.js";

export default class DirectMessageHandler {
  public static async create(req: Request, res: Response) {
    const { receiverId, contactInfo, content, photoId } = req.body;
    const senderId = req.token.id;
    if (!receiverId || !contactInfo || !content || !photoId) {
      Log.warn(`DirectMessage create failed: missing params sender:${senderId}`);
      return res.fail(HTTP_STATUS.BAD_REQUEST, "参数错误");
    }
    const addedMessage = await DirectMessage.createPrecheck(senderId);
    Log.debug(`DirectMessage precheck sender:${senderId} sent_in_24h:${addedMessage.length}`);
    if (addedMessage.length >= 5) {
      Log.warn(`DirectMessage rate limit exceeded sender:${senderId}`);
      return res.fail(HTTP_STATUS.BAD_REQUEST, "每24小时最多发送5条消息");
    }
    await DirectMessage.create(
      senderId,
      receiverId,
      photoId,
      contactInfo,
      content,
    );
    Log.info(`DirectMessage created sender:${senderId} -> receiver:${receiverId} photo:${photoId}`);
    res.success("发送成功");

    const [recvUser, sendUser, photo] = await Promise.all([
      User.getById(receiverId),
      User.getById(senderId),
      Photo.getById(photoId),
    ]);
    const photoInfo = (() => {
      let _str = `[${photo.id}]${photo.ac_reg}/`;
      _str += `${photo.airline_cn || photo.airline_en}`;
      return _str;
    })();

    try {
      await MailTemp.DirectMessageNotice(recvUser.user_email, {
        contact_info: contactInfo,
        content: content,
        photo_info: photoInfo,
        sender_name: sendUser.username,
        receiver_name: recvUser.username,
      });
      Log.debug(`DirectMessage notice mail for ${recvUser.user_email} added to MQ`);
    } catch (e) {
      Log.error(`DirectMessage notice mail of :${senderId} err:${(e as Error).message}`);
    }
  }
}

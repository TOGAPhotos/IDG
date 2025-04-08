import type { Request, Response } from "express";

import Log from "../../components/loger.js";
import { DirectMessage } from "../../dto/directMessage.js";
import { HTTP_STATUS } from "../../types/http_code.js";
import { DefaultErrorFallback } from "../../components/decorators/defaultErrorHandler.js";
import MailTemp from "../../service/mail/mailTemp.js";
import User from "../../dto/user.js";
import Photo from "../../dto/photo.js";

export default class DirectMessageHandler {

    @DefaultErrorFallback
    public static async create(req: Request, res: Response) {
        const { receiverId, contactInfo, content, photoId } = req.body;
        const senderId = req.token.id;
        if (!receiverId || !contactInfo || !content || !photoId) {
            return res.fail(HTTP_STATUS.BAD_REQUEST, '参数错误');
        }
        const addedMessage = await DirectMessage.createPrecheck(senderId);
        console.log(addedMessage);
        if (addedMessage.length >= 5) {
            return res.fail(HTTP_STATUS.BAD_REQUEST, '每24小时最多发送5条消息');
        }
        await DirectMessage.create(senderId, receiverId, photoId, contactInfo, content)
        res.success('发送成功');

        const [recvUser, sendUser, photo] = await Promise.all([
            User.getById(receiverId),
            User.getById(senderId),
            Photo.getById(photoId)
        ])
        const photoInfo = (() => {
            let _str = `[${photo.id}]${photo.ac_reg}/`
            _str += `${photo.airline_cn || photo.airline_en}`
            return _str
        })()

        await MailTemp.DirectMessageNotice(recvUser.user_email, {
            contact_info: contactInfo,
            content: content,
            photo_info: photoInfo,
            sender_name: sendUser.username,
            receiver_name: recvUser.username
        })
    }

}
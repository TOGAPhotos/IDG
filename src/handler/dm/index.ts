import type { Request, Response } from "express";

import Log from "../../components/loger.js";
import { DirectMessage } from "../../dto/directMessage.js";
import { HTTP_STATUS } from "../../types/http_code.js";
import { DefaultErrorFallback } from "../../components/decorators/defaultErrorHandler.js";

export default class DirectMessageHandler {

    @DefaultErrorFallback
    public static async create(req: Request, res: Response) {
        const { receiverId, contactInfo, content, photoId } = req.body;
        const userId = req.token.id;
        if (!receiverId || !contactInfo || !content) {
            return res.fail(HTTP_STATUS.BAD_REQUEST, '参数错误');
        }
        const addedMessage = await DirectMessage.createPrecheck(userId);
        console.log(addedMessage)
        if (addedMessage.length >= 5) {
            return res.fail(HTTP_STATUS.BAD_REQUEST, '每24小时最多发送5条消息');
        }
        await DirectMessage.create(req.token.id, receiverId, contactInfo, content);
        return res.success('发送成功');
    }

}
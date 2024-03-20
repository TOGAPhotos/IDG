import {Request, Response} from "express";
import UploadQueue from "../../dto/uploadQueue.js";
import {UploadQueueCache} from "../../service/redis/uploadQueueCache.js";
import Permission from "../../components/auth/permissions.js";
import User from "../../dto/user.js";
import {GetMinImage} from "../../components/compress.js";

export default class QueueHandler {

    static uploadQueueCache = new UploadQueueCache()

    static async getUserUploadQueue(req: Request, res: Response) {
        const result = await UploadQueue.getByUserId(req.token.id)
        return res.json({message: '查询成功', photoQueue: result});
    }

    static async getQueuePhoto(req: Request, res: Response) {
        const queueId = Number(req.params['id']);
        const screenCache = await this.uploadQueueCache.get(queueId);

        if(screenCache !== null && Number(screenCache) !== req.token.id){
            return res.status(HTTP_STATUS.BAD_REQUEST).json({message: '其他审图员正在审核中'});
        }else{
            await this.uploadQueueCache.update(queueId, req.token.id);
        }
        const result = await UploadQueue.getById(queueId)

        return res.json({message: '查询成功', photoQueue: result});
    }


    static async getQueueTop(req: Request, res: Response) {
        const cursor = Number(req.query['cursor']) || 0;
        const userInfo = await User.getById(req.token.id);
        let result = await UploadQueue.getTop(cursor,userInfo.role);

        while (await this.uploadQueueCache.get(result.queue_id) !== null) {
            result = await UploadQueue.getTop(result.queue_id,userInfo.role);
            if(result === null){
                return res.json({message: '没有待审核的图片'});
            }
        }

        return res.json({message: '查询成功', result: result.queue_id});

    }

    static async beater(req: Request, res: Response) {
        const action = req.query['action'];
        const queueId = Number(req.query['queueId']);

        if (action === 'open') {
            await this.uploadQueueCache.update(queueId, req.token.id);
        } else {
            await this.uploadQueueCache.del(queueId);
        }
        return res.end();
    }

    static async processScreenResult(req: Request, res: Response) {
        const queueId = Number(req.params['id']);
        const screenerId = req.token.id
        const screenerInfo = await User.getById(screenerId);
        let finishScreen = false;

        const queuePhoto = await UploadQueue.getById(queueId);

        if (queuePhoto.screener_1 !== null && queuePhoto.screener_2 !== null) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({message: '已完成审核'});
        }

        let screenData: {
            screener_1?: number,
            result: number,
            reason: string,
            screener_message: string,
            screener_2?: number,
            need_screener_2?: number
        }

        if (queuePhoto['screener_1'] === null) {
            screenData = {
                screener_1: req.token.id,
                result: req.body['result'],
                reason: req.body['reason'],
                screener_message: req.body["screener_message"],
                need_screener_2: req.body['need_screener_2']
            }
            if (
                Permission.isSeniorScreener(screenerInfo.role) &&
                req.body["need_screener_2"] === 0
            ) {
                screenData.screener_2 = req.token.id;
                finishScreen = true;
            }

        } else if (
            queuePhoto['screener_1'] !== null &&
            queuePhoto['screener_2'] === null &&
            Permission.isSeniorScreener(screenerInfo.role)
        ) {
            screenData = {
                screener_2: req.token.id,
                result: req.body['result'],
                reason: req.body['reason'],
                screener_message: req.body["screener_message"],
            }
            finishScreen = true;
        }else{
            return res.status(HTTP_STATUS.BAD_REQUEST).json({message: '错误请求'});
        }
        await UploadQueue.update(queueId, screenData);
        if(finishScreen){
            if (Number(req.body["result"]) === 1) {
                GetMinImage(`/photos/${queuePhoto['photo_id']}.jpg`);
            }
            await User.updatePassingRate(queuePhoto['user_id']);
        }
    }

    static async getScreenedPhoto(req: Request, res: Response) {
        const result = await UploadQueue.recentScreenPhoto();
        return res.json({message: "查询成功", result});
    }

    static async userRejectQueue(req: Request, res: Response) {
        const result = await UploadQueue.rejectQueue(req.token.id);
        return res.json({message: "查询成功", rejectQueue: result});
    }
}
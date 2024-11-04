import {Request, Response} from "express";
import UploadQueue from "../../dto/uploadQueue.js";
import {UploadQueueCache} from "../../service/redis/uploadQueueCache.js";
import Permission from "../../components/auth/permissions.js";
import User from "@/dto/user.js";
import {GetMinImage} from "@/components/compress.js";
import { HTTP_STATUS } from "@/types/http_code.js";

export default class QueueHandler {

    static uploadQueueCache = new UploadQueueCache()

    static async getUserUploadQueue(req: Request, res: Response) {
        const result = await UploadQueue.getByUserId(req.token.id)
        return res.json({message: '查询成功', photoQueue: result});
    }

    static async getQueuePhoto(req: Request, res: Response) {
        const queueId = Number(req.params['id']);
        const screenCache = await QueueHandler.uploadQueueCache.get(queueId);

        if(screenCache !== null && Number(screenCache) !== req.token.id){
            return res.status(HTTP_STATUS.BAD_REQUEST).json({message: '其他审图员正在审核中'});
        }else{
            await QueueHandler.uploadQueueCache.update(queueId, req.token.id);
        }
        const result = await UploadQueue.getById(queueId)

        return res.success('查询成功', result);
    }

    static async getQueueTop(req: Request, res: Response) {
        const cursor = Number(req.query['cursor']) || 0;
        const userInfo = await User.getById(req.token.id);

        const MAX_TRY = 10;
        
        for(let counter = 0;counter<MAX_TRY;counter++){
            let result = await UploadQueue.getTop(cursor,userInfo.role);
            const cacheInfo = await QueueHandler.uploadQueueCache.get(result.photo_id);
            if(cacheInfo === null || Number(cacheInfo) === req.token.id){
                await QueueHandler.uploadQueueCache.set(result.photo_id,userInfo.id);
                return res.success("查询成功",{photoId:result.photo_id});
            }
        }

        return res.fail(HTTP_STATUS.SERVER_ERROR,'服务器错误');
    }

    static async beater(req: Request, res: Response) {
        const action = req.query['action'];
        const queueId = Number(req.params['id']);

        if (action === 'open') {
            const update = await QueueHandler.uploadQueueCache.update(queueId, req.token.id);
            if(!update){
                return res.fail(HTTP_STATUS.BAD_REQUEST,'其他审图员正在审核中');
            }
        } else {
            await QueueHandler.uploadQueueCache.del(queueId);
        }
        return res.success('success',action);
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
                await GetMinImage(`/photos/${queuePhoto['photo_id']}.jpg`);
            }
            await User.updatePassingRate(queuePhoto['user_id']);
        }
    }

    static async getQueue(req: Request, res: Response) {
        type _QueueType = 'normal' | 'priority' | 'stuck';
        const type =  req.query['type']  || 'normal' ;
        switch (type) {
            case 'screened':
                return await QueueHandler.getScreenedPhoto(req, res);
            default:
                const dbRes = await UploadQueue.getQueue(<_QueueType>type);
                return res.success('查询成功', dbRes);
        }
    }

    

    static async getScreenedPhoto(req: Request, res: Response) {
        const result = await UploadQueue.recentScreenPhoto();
        return res.success('查询成功', result);
    }

    static async userRejectQueue(req: Request, res: Response) {
        const result = await UploadQueue.rejectQueue(req.token.id);
        return res.json({message: "查询成功", rejectQueue: result});
    }
}
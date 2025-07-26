import {Request, Response} from "express";
import UploadQueue from "../../dto/uploadQueue.js";
import {UploadQueueCache} from "../../service/redis/uploadQueueCache.js";
import Permission from "../../components/auth/permissions.js";
import User from "@/dto/user.js";
import { HTTP_STATUS } from "@/types/http_code.js";

export default class QueueHandler {

    static uploadQueueCache = new UploadQueueCache()

    static async getUserUploadQueue(req: Request, res: Response) {
        const result = await UploadQueue.getPhotosQueueByUserId(req.token.id)
        result.forEach((photo)=>{
            delete photo.screener_1;
            delete photo.screener_2;
            delete photo.result;
            delete photo.screener_message;
            delete photo.reason;
        })
        return res.success('查询成功', {photoQueue: result})
    }

    static async getQueuePhoto(req: Request, res: Response) {
        const queueId = Number(req.params['id']);
        const readOnly = req.query['readonly'] === '1';

        if (!readOnly) {
            const screenCache = await QueueHandler.uploadQueueCache.get(queueId);
            if (screenCache !== null && Number(screenCache) !== req.token.id) {
                return res.fail(HTTP_STATUS.CONFLICT, '其他审图员正在审核中');
            }
            await QueueHandler.uploadQueueCache.set(queueId, req.token.id);
        }

        const result = await UploadQueue.getById(queueId);
        return res.success('查询成功', result);
    }

    static async getQueueTop(req: Request, res: Response) {
        const cursor = Number(req.query['cursor']) || 0;
        const screener = await User.getById(req.token.id);

        const MAX_TRY = 10;
        
        for(let counter = 0;counter<MAX_TRY;counter++){
            let result = await UploadQueue.getTop(cursor,screener.role);
            if(result.upload_user_id === screener.id){ // 跳过自己上传的图片
                continue;
            }
            const cacheInfo = await QueueHandler.uploadQueueCache.get(result.id);
            if(cacheInfo === null || Number(cacheInfo) === req.token.id){
                await QueueHandler.uploadQueueCache.set(result.id,screener.id);
                return res.success("查询成功",{photoId:result.id});
            }
        }

        return res.fail(HTTP_STATUS.LOOP_DETECTED)
    }

    static async beater(req: Request, res: Response) {
        const action = req.query['action'];
        const queueId = Number(req.params['id']);

        if (action === 'open') {
            const update = await QueueHandler.uploadQueueCache.update(queueId, req.token.id);
            if(!update){
                return res.fail(HTTP_STATUS.CONFLICT,'其他审图员正在审核中');
            }
        } else {
            await QueueHandler.uploadQueueCache.del(queueId);
        }
        return res.success('success',action);
    }

    static async stuckPhoto(req: Request, res: Response) {
        const queueId = Number(req.params['id']);
        const queuePhoto = await UploadQueue.getById(queueId);
        if(queuePhoto.status !== 'WAIT SCREEN'){
            return res.fail(HTTP_STATUS.BAD_REQUEST,'图片已审核');
        }
        try{
            await UploadQueue.update(queueId, {
                status: 'STUCK',
                reason: req.body['reason'],
            });
        }catch(e){
            return res.fail(HTTP_STATUS.SERVER_ERROR,'操作失败');
        }
        return res.success('success');
    }

    static async processScreenResult(req: Request, res: Response) {
        const queueId = Number(req.params['id']);
        const screenerId = req.token.id
        let finishScreen = false;

        if(req.body['result'] === "STUCK"){
            return QueueHandler.stuckPhoto(req,res);
        }

        const [screener,queuePhoto] = await Promise.all([
            User.getById(screenerId),
            UploadQueue.getById(queueId)
        ])

        if (queuePhoto.screener_1 !== null && queuePhoto.screener_2 !== null) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({message: '已完成审核'});
        }

        let screenData: {
            screener_1?: number,
            result: string,
            reason: string,
            screener_message: string,
            screener_2?: number,
            need_screener_2?: boolean
        } = {
            result: req.body['result'],
            reason: req.body['reason'],
            screener_message: req.body["screener_message"],
        }

        if (queuePhoto.screener_1 === null) {
            screenData.screener_1 = req.token.id;
            screenData.need_screener_2 = req.body['need_screener_2'] === 1;
            if (
                Permission.isSeniorScreener(screener.role) &&
                !req.body["need_screener_2"]
            ) {
                screenData.screener_2 = req.token.id;
                finishScreen = true;
            }

        } else if (
            queuePhoto.screener_1 !== null &&
            queuePhoto.screener_2 === null &&
            Permission.isSeniorScreener(screener.role)
        ) {
            screenData.screener_2 = req.token.id;
            finishScreen = true;
        }else{
            return res.fail(HTTP_STATUS.BAD_REQUEST,'错误请求');
        }
        await UploadQueue.update(queueId, screenData);
        if(finishScreen){
            await UploadQueue.update(queueId, {status: screenData.result});
            await Promise.allSettled([
                User.updatePassingRate(queuePhoto.upload_user_id),
                User.updateById(queuePhoto.upload_user_id,{
                    free_queue: {increment: 1},
                    total_photo:{increment: screenData.result === 'ACCEPT' ? 1 : 0},
                    // free_priority_queue: {increment: queuePhoto.queue === 'PRIORITY' ? 1 : 0}
                })
            ])
        }
        return res.success('success', {id:queueId, ...screenData});
    }

    static async rejectQueue(req: Request, res: Response) {
        const userId = Number(req.params['id']);
        const uploadQueue = await UploadQueue.getByUserId(userId);
        const updateTasks = uploadQueue.map(async (photo)=>{
            const screening = await QueueHandler.uploadQueueCache.get(photo.id)
            if(
                screening !== null && 
                Number(screening) !== req.token.id
            ){
                return {id:photo.id, result:false}
            }
            await UploadQueue.update(photo.id, {
                screener_1: req.token.id,
                screener_2: req.token.id,
                status: 'REJECT',
                result: 'REJECT',
                reason: "图片质量不佳",
            });
            return {id:photo.id, result:true}
        })
        const results = await Promise.allSettled(updateTasks);
        const rejectPhotoCount = results.reduce((acc,result)=>{
            if(result.status === "rejected") return acc;
            return acc += result.value.result ? 1 : 0
        },0);
        await User.updateById(userId,{
            free_queue: {increment: rejectPhotoCount},
            free_priority_queue: 0
        })
        return res.success('success',results);
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
        res.success('查询成功', {rejectList:result});
    }
}
import prisma from "./prisma.js";
import { Request,Response } from "express";

export async function UpdatePhotoInfo(req:Request, res:Response) {
    const userId = req.token.id;
    let photoId = Number(req.params['id']);

    const jobResult = await Promise.allSettled([
        prisma.user.findUnique({where: {id: userId}}),
        prisma.photo.findUnique({where: {id: photoId}}),

    ]);

    if(jobResult[0].status === "rejected"){
        throw new Error(jobResult[0].reason);
    }
    const userInfo = jobResult[0].value;
    
    if(jobResult[1].status === "rejected"){
        throw new Error(jobResult[1].reason);
    }
    const photoInfo = jobResult[1].value;

    if (photoInfo["is_delete"]) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({message: "已删除"});
    }
    
    if (userInfo['role'] <= 1 && req.token.id !== photoInfo['uploader']) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({message: '无权限'});
    }

    if (photoInfo['in_upload_queue']) {
        const queueInfo = await prisma.upload_queue.findUnique({where: {photo_id: photoId}});
        if (queueInfo['screening']) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({message: '正在审核中'});
        }
    }
    
    await prisma.photo.update({where: {id: photoId}, data: req.body});

    return res.json({message:"更新成功"});
}
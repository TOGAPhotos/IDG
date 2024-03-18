import prisma from "./prisma.js";
import { Request,Response } from "express";
import Permission from "../../components/auth/permissions.js";
import User from "../../dto/user.js";
import Photo from "../../dto/photo.js";

export async function UpdatePhotoInfo(req:Request, res:Response) {
    let photoId = Number(req.params['id']);

    const userInfo = await User.getById(req.token.id);
    const photoInfo = await Photo.getById(photoId);

    if (photoInfo) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({message: "已删除"});
    }
    
    if (Permission.checkUserPermission(userInfo.role,'DATABASE') && req.token.id !== photoInfo['uploader']) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({message: '无权限'});
    }

    if (photoInfo['in_upload_queue']) {
        /**
         * @todo 修改图片信息
         * */
        // const queueInfo = await prisma.upload_queue.findUnique({where: {photo_id: photoId}});
        // if (queueInfo['screening']) {
        //     return res.status(HTTP_STATUS.FORBIDDEN).json({message: '正在审核中'});
        // }
    }
    
    await prisma.photo.update({where: {id: photoId}, data: req.body});

    return res.json({message:"更新成功"});
}
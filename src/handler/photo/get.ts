import prisma from "./prisma.js";
import { Request, Response } from "express";
import {Photo} from "../../dto/photo.js";
import {checkNumberParams} from "../../components/decorators/checkNumberParams.js";

export async function GetPhoto(req: Request, res: Response) {

    const id = Number(req.params['id']);

    const photoInfo = await Photo.getPhotoById(id);


    if (!photoInfo || photoInfo['is_delete']) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ message: '图片不存在' });
    }

    // photoInfo['photo_time'] = Number(photoInfo['upload_time']);
    // if (photoInfo["aircraft"]) {
    //     delete photoInfo["aircraft"]['create_time']
    // }

    if(photoInfo[''])

    // 检查是否在队列内
    if (photoInfo['in_upload_queue']) {
        if (!req.token) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({ message: '无权限' });
        }

        // 检查是否为上传用户
        if (Number(req.token.id) === photoInfo["uploader_id"]) {
            return res.json({ message: '成功', photoInfo });
        }

        // 搜索用户
        const userInfo = await prisma.user.findUnique({
            where: {
                id: req.token.id,
            }
        });

        // 检查是否为审图员
        if (!userInfo['is_deleted'] && userInfo['role'] > 0) {
            return res.json({ message: '成功', photoInfo });
        }

        return res.status(HTTP_STATUS.FORBIDDEN).json({ message: '无权限' });
    }
    else {
        return res.json({ message: '成功', photoInfo });
    }
}

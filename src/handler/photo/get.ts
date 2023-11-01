import prisma from "./prisma.js";
import { Request, Response } from "express";

export async function GetPhoto(req: Request, res: Response) {
    const id = req.params['id'];
    let photoInfo = await prisma.$queryRawUnsafe(`
        SELECT a.photo_url,
               a.reg,
               a.msn,
               a.airline,
               a.remark,
               a.allow_socialmedia,
               a.vote,
               a.photo_time,
               b.manufacturer,
               b.sub_type,
               c.id       AS uploader_id,
               c.username AS uploader,
               d.iata,
               d.icao,
               d.id       AS airport_id,
               d.cn_name,
               a.in_upload_queue
        FROM (SELECT * FROM photo WHERE id = ${id}) AS a
                 LEFT JOIN airtype AS b ON b.sub_type = a.airtype,
             user c,
             airport d
        WHERE c.id = a.uploader
          AND a.airport_info = d.id
    `);

    photoInfo = photoInfo[0];


    if (!photoInfo || photoInfo['is_delete']) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ message: '图片不存在' });
    }

    photoInfo['upload_time'] = Number(photoInfo['upload_time']);
    if (photoInfo["aircraft"]) {
        delete photoInfo["aircraft"]['create_time']
    }


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

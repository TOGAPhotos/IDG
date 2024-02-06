import fs from "fs";
import { Request, Response } from "express";


import prisma from "./prisma.js";
import {CheckPromiseResult} from "../../components/promise-check.js";
import {Logger} from "../../components/loger.js";

import {photoBaseFolder} from "../../config.js";
import {GetPhotoList} from "../website/info.js";
const photoFolder = `${photoBaseFolder}/photos`;

// export async function DelPhotoFromDisk(){
//
// }

export async function DelPhoto(req:Request, res:Response) {
    const userId = req.token.id;
    let photoId = Number(req.params['id']);

    const jobList = await Promise.allSettled([
        prisma.user.findUnique({where: {id: userId}}),
        prisma.photo.findUnique({where: {id: photoId}}),
    ]);

    const resultArray = CheckPromiseResult(jobList)

    const userInfo = resultArray[0];
    const photoInfo = resultArray[1];

    Logger.info(`access_id:${req.uuid} user_id:${userId} username:${userInfo['username']} 尝试删除图片 ${photoId}`);

    if (photoInfo["is_delete"]) {
        Logger.info(`access_id:${req.uuid} user_id:${userId} username:${userInfo['username']} 图片 ${photoId} 已被删除`);
        return res.status(HTTP_STATUS.NOT_FOUND).json({message: "已删除"});
    }

    if(userInfo['status'] === 1){
        return res.status(HTTP_STATUS.FORBIDDEN).json({message: "账户已暂停"});
    }

    //上传用户删除队列中的图片
    if (photoInfo['in_upload_queue'] && req.token.id === photoInfo['uploader']) {
        const queueInfo = await prisma.upload_queue.findUnique({where: {photo_id: photoId}});
        if (queueInfo.screening === true) {
            Logger.info(`access_id:${req.uuid} user_id:${userId} username:${userInfo['username']} 图片 ${photoId} 正在审核中，删除失败`);
            return res.status(HTTP_STATUS.BAD_REQUEST).json({message: "删除失败，正在审核中"});
        }

        let priorityQueue = userInfo['free_priority_queue'];
        if (queueInfo['queue'] === 'priority') {
            priorityQueue++;
        }
        await Promise.all([
            prisma.photo.update({
                where: {
                    id: photoId,
                },
                data: {
                    is_delete: true,
                }
            }),
            prisma.upload_queue.update({
                where: {
                    photo_id: photoId
                },
                data: {
                    is_delete: true,
                }
            }),
            prisma.user.update({
                where: {
                    id: userId
                },
                data: {
                    free_queue: userInfo['free_queue'] + 1,
                    free_priority_queue: priorityQueue,
                }
            }),
            fs.unlink(`${photoFolder}/${photoId}.jpg`, (err) => {
                Logger.error(err)
                console.log(err)
            }),
        ]);
        Logger.info(`access_id:${req.uuid} user_id:${userId} username:${userInfo['username']} 删除了队列中的图片 photo_id:${photoId} `);

    }

    //screener删除已过审图片
    if (!photoInfo['in_upload_queue']) {
        if (userInfo['role'] <= 1 && req.token.id !== photoInfo['uploader']) {
            return res.status(403).json({message: '无权限'});
        }
        await Promise.allSettled([
            prisma.photo.update({
                where: {
                    id: photoId,
                },
                data: {
                    is_delete: true,
                }
            }),
            prisma.upload_queue.update({
                where: {
                    photo_id: photoId
                },
                data: {
                    is_delete: true
                }
            }),
            fs.unlink(`${photoFolder}/${photoId}.jpg`, (err) => {
                console.log(err)
            }),
            fs.unlink(`${photoBaseFolder}/min/photos/${photoId}.jpg`, (err) => {
                console.log(err)
            }),
        ])
        await Promise.allSettled([
            GetPhotoList(),
            await prisma.$queryRawUnsafe(`
                UPDATE user
                SET total_photo =(SELECT count(id)
                                  FROM photo
                                  WHERE uploader = ${photoInfo['uploader']}
                                    AND in_upload_queue = 0
                                    AND result = 1
                                    AND is_delete = 0)
                WHERE id = ${photoInfo['uploader']}
            `)
        ])
        Logger.info(`access_id:${req.uuid} user_id:${userId} username:${userInfo['username']} 删除了已入库的图片 photo_id:${photoId} `);
    }

    return res.json({message: '删除成功'});

}
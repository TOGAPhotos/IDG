import prisma from "./prisma.js";
import multer from 'multer';
import { photoBaseFolder } from "../../config.js";
import { ConvertSqlValue } from "../../components/sql.js";
import fs from 'fs'
import { Request, Response, NextFunction } from "express"
import Logger  from "../../components/loger.js";
import User from "../../dto/user.js";
// import {CheckUserStatus, Permission} from "../../components/auth/permissions.js";

export async function UploadPreProcess(req: Request, res: Response, next: NextFunction) {
    const userId = req.token.id;
    const userInfo = await User.getById(userId);
    const queue = req.body['queue'];

    // if( !CheckUserStatus(userInfo) ){
    //     return res.status(HTTP_STATUS.FORBIDDEN).json({message: "您暂时不能上传图片"});
    // }

    if (queue === 'priority' && userInfo.free_priority_queue <= 0) {
        req.body['queue'] = 'normal';
    }

    if (userInfo.free_queue <= 0) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: '无剩余队列' });
    }

    next();
}

const photoFolder = photoBaseFolder + '/photos';

const storage = multer.diskStorage({
/**
 * @todo 修改storage
 * */
//     destination: function (req, file, callback) {
//         callback(null, photoFolder);
//     },
//     filename: async function (req, file, callback) {
//         const d = new Date();
//         const dbResult = await prisma.photo.create({
//             data: {
//                 uploader: req.token.id, upload_time: d.getTime(),reg:req.body["reg"],
//             }
//         });
//         const photoId = dbResult.id
//         await prisma.photo.update({
//             data: {
//                 photo_url: `/photos/${photoId}.jpg`,
//             }, where: {
//                 id: photoId,
//             }
//         })
//         req.body['photoId'] = photoId;
//         callback(null, `${photoId}.jpg`);
//     }
});

export const photoUpload = multer({storage: storage});

function InfoCheck(req:Request){

    Logger.info(`
    ${req.uuid}
    ${JSON.stringify(req.body)}

    `)

    if(req.body["reg"] === ''){
        return false
    }

    if(req.body.airport === undefined){
        return false
    }

    if( isNaN(Number(req.body['airport'])) ){
        return false
    }

    return true
}

export async function UploadHandler(req:Request, res:Response) {

    let dataParam = {
        reg: req.body["reg"],
        msn: req.body["msn"],
        airline: req.body["airline"],
        airtype: req.body["airtype"],
        pic_type: req.body['picType'],
        photo_time: new Date(req.body['photoDate']),
        remark: ConvertSqlValue(req.body['remark']),
        allow_socialmedia: (req.body['allowSocialMedia'] === '1'),
    }

    if( !InfoCheck(req) ){
        const photoId = req.body['photoId'];
        await Promise.all([
            prisma.photo.update({
                where: {
                    id: photoId,
                },
                data: {
                    is_delete: true,
                }
            }),
            fs.unlink(`${photoFolder}/${photoId}.jpg`, (err) => {
                console.log(err)
            }),
        ]);
        return res.status(400).json({message: '服务器端信息缺失'});
    }

    req.body['aircraftInfoId'] = Number(req.body['aircraftInfoId']);
    if (req.body['aircraftInfoId'] !== -1) {
        dataParam['aircraft_info'] = req.body['aircraftInfoId'];
    }

    dataParam['airport_info'] = Number(req.body['airport']);

    let sql = `UPDATE user
               SET free_queue = free_queue - 1
               WHERE id = ${req.token.id}`;

    if (req.body['queue'] === 'priority') {
        sql = `UPDATE user
               SET free_queue          = free_queue - 1,
                   free_priority_queue = free_priority_queue - 1
               WHERE id = ${req.token.id}`;
    }

    await Promise.allSettled([
        // prisma.upload_queue.create({
        //     data: {
        //         photo_id: req.body['photoId'],
        //         user_id: req.token.id,
        //         queue: req.body['queue'],
        //         comment: req.body['comments']
        //     }
        // }),
        prisma.photo.update({
            where: {id: req.body['photoId']},
            data: dataParam,
        }),
        prisma.$queryRawUnsafe(sql)
    ])


    return res.json({message: '上传成功', photoId: req.body['id']});
}
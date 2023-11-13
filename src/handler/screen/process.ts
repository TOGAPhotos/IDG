import { CheckPromiseResult } from "../../components/promise-check.js";
import prisma from "./prisma.js";
import { Request,Response } from "express"
import { GetMinImage } from "../../components/compress.js";
export async function ProcessScreenResult(req:Request, res:Response) {
    
    const queueId = Number(req.params['id']);
    const userId = req.token.id
    let finishScreen = false;

    // 查询图片信息
    const jobList = await Promise.allSettled([
        prisma.upload_queue.findUnique({where: {id: queueId,}}),
        prisma.user.findUnique({where: {id: userId}}),
    ]);

    const resultList = CheckPromiseResult(jobList);

    const queuePhoto = resultList[0];
    const screenerInfo = resultList[1];

    // 检查图片信息
    if (queuePhoto['screener_1'] !== null && queuePhoto['screener_2'] !== null) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({message: '已完成审核'});
    }

    if(queuePhoto['is_delete']){
        return res.status(HTTP_STATUS.NOT_FOUND).json({message: '已删除'})
    }

    let screenData

    // 一审
    if (queuePhoto['screener_1'] === null) {
        screenData = {
            screener_1: req.token.id,
            result: req.body['result'],
            reason: req.body['reason'],
            screener_message: req.body["screener_message"],
            need_screener_2: req.body['need_screener_2']
        }

        // 不需要二审
        if (req.body["need_screener_2"] === 0 && screenerInfo["role"] >= 2) {
            screenData.screener_2 = req.token.id;
            finishScreen = true;
        }

    }else if (queuePhoto['screener_1'] !== null && queuePhoto['screener_2'] === null && screenerInfo["role"] >= 2){
        screenData = {
            screener_2: req.token.id,
            result: req.body['result'],
            reason: req.body['reason'],
            screener_message: req.body["screener_message"],
        }
        finishScreen = true;
    }else{
        return res.status(HTTP_STATUS.BAD_REQUEST).json({message: '错误'});
    }

    // 更新信息
    await prisma.upload_queue.update({
        where: {
            id: queueId,
        },
        data: screenData
    });

    // console.log(screenData)

    if(finishScreen){

        // 缩略图
        if (Number(req.body["result"]) === 1) {
            GetMinImage(`/photos/${queuePhoto['photo_id']}.jpg`);
        }

        await Promise.all([
            // 更新Photo表
            prisma.photo.update({
                where: {
                    id: queuePhoto['photo_id'],
                },
                data: {
                    in_upload_queue: false,
                    result: req.body['result'],
                }
            }),
            // 更新User表的剩余队列数据
            prisma.$queryRawUnsafe(
                `UPDATE user
                     SET free_queue  = free_queue + 1,
                         total_photo = total_photo + ${req.body["result"]}
                     WHERE id = ${queuePhoto['user_id']}
                    `
            )
        ]);
        // 重新计算过图率
        await prisma.$queryRawUnsafe(`
                UPDATE user
                SET passing_rate = (
                    SELECT round(sum(a.result) / count(a.id) * 100, 0)
                    FROM (
                         SELECT id, result
                         FROM photo
                         WHERE is_delete = 0
                           AND in_upload_queue = 0
                           AND uploader = ${queuePhoto['user_id']}
                         ORDER BY id DESC
                         LIMIT 50)
                        AS a)
                WHERE id = ${queuePhoto['user_id']}
            `);
    }

    return res.json({message:"审核完成"})
}
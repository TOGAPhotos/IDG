import prisma from "./prisma.js"
import { Request, Response } from "express"

export async function GetUserInfo(req:Request, res:Response) {
    const queryId = Number(req.params['id']);

    const dbResult = await prisma.user.findUnique({
        where: {id: queryId},
        select: {
            total_photo: true,
            passing_rate: true,
            username: true,
            free_queue: true,
            free_priority_queue: true,
            status: true,
            is_deleted: true,
        }
    });

    let photoList = [];
    if (!(req.query["action"] === 'uploadCheck')) {
        photoList = await prisma.photo.findMany({
            select: {
                id: true,
                photo_url: true,
                airline: true,
                airtype: true,
                reg: true,

            },
            where: {
                uploader: queryId,
                is_delete: false,
                result: 1,
                in_upload_queue: false,
            },
        });
    }

    if (!dbResult || dbResult.is_deleted) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({message: '用户不存在'});

    }

    return res.json({message: '查询成功', userInfo: dbResult, photoList});
}

export async function GetUserList(req:Request, res:Response){

    let limit = Number(req.query['recent']) || 200;

    const dbResult = await prisma.$queryRawUnsafe(`
        SELECT id,
               username,
               user_email,
               role,
               -- passing_rate,
               total_queue,
               free_queue,
               priority_queue,
               free_priority_queue,
               total_photo,
               status,
               suspension_days
               -- create_time
        FROM user
        WHERE is_deleted = 0
        ORDER BY id
                DESC
        LIMIT ${limit}
    `)

    return res.json({message: '查询成功', data: dbResult});
}
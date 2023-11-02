import prisma from "./prisma.js"
import { Request, Response } from "express"

export async function GetUserInfo(req:Request, res:Response) {
    const queryId = Number(req.params['id']);
    
    const dbResult = await prisma.user.findUnique({
        where: {id: queryId},
        select:{
            total_photo:true,
            passing_rate:true,
            username:true,
            free_queue:true,
            free_priority_queue:true,
            status:true,
            is_deleted:true,
        }
    });
    
    let photoList = [];
    if(!(req.query["action"] === 'uploadCheck')){
        photoList = await prisma.photo.findMany({
            select:{
                id:true,
                photo_url:true,
                airline:true,
                airtype:true,
                reg:true,

            },
            where:{
                uploader:queryId,
                is_delete:false,
                result:1,
                in_upload_queue:false,
            },
        });
    }

    if (dbResult) {
        if(dbResult.is_deleted){
            return res.status(HTTP_STATUS.NOT_FOUND).json({message: '用户不存在'});
        }
        return res.json({message: '查询成功', userInfo: dbResult,photoList});
    } else {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({message: '非法查询'});
    }
}
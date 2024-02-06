import {Request,Response} from "express";
import prisma from "./prisma.js";

export async function RejectQueue(req:Request, res:Response) {
    const uploader = Number(req.params['id']);

    if(isNaN(uploader)){
        throw new Error('参数错误');
    }

    const { count } = await prisma.upload_queue.updateMany({
        where:{
            user_id:uploader,
            is_delete:false,
            screener_2:null,
        },
        data:{
            screener_2:req.token.id,
            screener_1:req.token.id,
            result:0,
        }
    });


    await Promise.allSettled([
        prisma.$queryRawUnsafe(`
        UPDATE photo
        SET in_upload_queue = 0
        WHERE uploader = ${uploader}
            AND is_delete = 0
            AND in_upload_queue = 1
        `),
        prisma.$queryRawUnsafe(`
        UPDATE user
        SET free_queue = user.free_queue + ${count}
        WHERE id = ${uploader}
        `),
    ])
    return res.json({message:'清除成功'});
}
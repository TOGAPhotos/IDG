import prisma from "./prisma.js";
import { Request,Response } from "express"

export async function GetScreenPhoto(req: Request, res: Response) {
    const queueId = Number(req.params['id']);
    if(isNaN(queueId)){
        throw new Error("Invalid queue ID");
    }

    let queuePhoto = await prisma.upload_queue.findUnique({
        where: {id: queueId},
        include: {
            photo: {
                include: {
                    user: {
                        select: {
                            username: true
                        },
                    },
                    airport: {
                        select: {
                            icao: true,
                            iata: true,
                            cn_name: true,
                        }
                    },
                },
            },
        },
    });

    if(!queuePhoto || queuePhoto.is_delete){
        return res.status(HTTP_STATUS.NOT_FOUND).json({message:"ID不存在"});
    }

    if(queuePhoto.screener_1 !== null && queuePhoto.screener_2 !== null){
        return res.status(HTTP_STATUS.BAD_REQUEST).json({message: "审核已结束"});
    }

    if(queuePhoto.screening){
        return res.status(HTTP_STATUS.BAD_REQUEST).json({message: "其他审图员正在审核中"});
    }

    delete queuePhoto['upload_time']
    delete queuePhoto['last_screen_time']
    delete queuePhoto['photo']['upload_time']
    
    return res.json({message: '成功', photo: queuePhoto});
}
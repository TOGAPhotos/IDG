import prisma from "../prisma.js";
import { Request,Response } from "express"
import airlineSearchCache from "./cache.js";
import { SendInfoReviewNoticeEmail } from "../../../components/email/info-mail.js";

export async function DeleteAirline(req:Request, res:Response) {
    const id = Number(req.params.id);
    if(isNaN(id)){
        throw new Error('参数错误')
    }
    const airline = await prisma.airline.update({
        where: {
            id: id,
        },
        data: {
            is_delete: true
        }
    });
    res.json({message: '删除成功'});

    if (req.query["type"] === 'review') {

        const user = await prisma.user.findUnique({
                where: {id: airline.add_user},
            })

        
        if (!user.is_deleted) {
            await SendInfoReviewNoticeEmail(
                user['user_email'],
                'reject',
                airline['airline_cn_name'],
                airline['icao'],
                airline['iata']
            );

        }

    }else{
        airlineSearchCache.clear();
    }
}
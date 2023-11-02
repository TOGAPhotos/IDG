import prisma from "../prisma.js";
import { Request,Response } from "express"
import { SendInfoReviewNoticeEmail } from "../../../components/email/info-mail.js";

export async function UpdateAirportInfo(req:Request, res:Response) {
    const airportId = Number(req.params.id);

    if(isNaN(airportId)){
        throw new Error('参数错误')
    }

    await prisma.airport.update({
        where: {
            id: airportId,
        },
        data: req.body,
    })
    res.json({message: '修改成功'});

    if (req.query["type"] === 'review') {
        let applicantUserId = (await prisma.airport.findUnique({where:{id:airportId}})).add_user;

        let applicantUser = await prisma.user.findUnique({
                where: {id: applicantUserId},
            }
        );

        
        if (!applicantUser.is_deleted) {
            return SendInfoReviewNoticeEmail(
                applicantUser.user_email,
                'accept',
                req.body?.cn_name,
                req.body?.icao,
                req.body?.iata
            );

        }

    }

}
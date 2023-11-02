import prisma from "../prisma.js";
import { Request,Response } from "express"
import { SendInfoReviewNoticeEmail } from "../../../components/email/info-mail.js";

export async function DeleteAirport(req:Request, res:Response) {
    const airportId = Number(req.params.id);
    
    if(isNaN(airportId)){
        throw new Error('参数错误')
    }

    await prisma.airport.update({
        where: {id: airportId},
        data: {is_delete: true},
    });

    res.json({message: '删除成功'})

    if (req.query["type"] === 'review') {
        const airportInfo = await prisma.airport.findUnique({where: {id: airportId}});

        const user = await prisma.user.findUnique({
            where: {id: airportInfo["add_user"]},
        });

        // if user not delete ,email user
        if (!user['is_delete']) {
            await SendInfoReviewNoticeEmail(
                user['user_email'],
                'reject',
                airportInfo["cn_name"],
                airportInfo["icao"],
                airportInfo["iata"]
            );

        }

    }

}
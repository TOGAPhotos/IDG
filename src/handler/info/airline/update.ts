import prisma from "../prisma.js";
import { Request,Response } from "express"
// import { CheckPromisResult } from "../../../components/promise-check.js";
import airlineSearchCache from "./cache.js";
import { SendInfoReviewNoticeEmail } from "../../../components/email/info-mail.js";

export async function UpdateAirlineInfo(req:Request, res:Response) {

    const id = Number(req.params.id);

    const dbResult = await prisma.airline.update({
        where: {id: id},
        data: req.body,
    });

    res.json({message: '修改成功'});

    const add_user = dbResult.add_user;

    if (req.query["type"] === 'review') {

        const user = await prisma.user.findUnique({
                where: {id: add_user},
            }
        );
        // if user not delete ,email user
        if (!user['is_delete']) {
            return SendInfoReviewNoticeEmail(
                user['user_email'],
                'accept',
                req.body?.airline_cn_name,
                req.body?.icao,
                req.body?.iata
            );
        }
    }

    airlineSearchCache.clear();

}
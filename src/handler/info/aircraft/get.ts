import prisma from "../prisma.js";
import { Request,Response } from "express"

export async function SearchAircraft(req:Request, res:Response) {
    const {reg} = req.params;

    if (reg === '') {
        return res.end();
    }

    const data = await prisma.aircraft.findMany({
        where: {
            reg: reg,
            is_delete: false,
        },
    });
    if (data.length === 0) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({message: '无匹配记录'});
    } else {
        return res.json({message: '查询成功', data: data});
    }
}

export async function GetAircraftList(req:Request, res:Response) {
    const result = await prisma.$queryRawUnsafe(
        `SELECT id, reg, msn, airline, air_type
         FROM aircraft
         WHERE is_delete = false
         ORDER BY id DESC
         LIMIT 200`
    );
    return res.json({message: '查询成功', aircraft: result});
}
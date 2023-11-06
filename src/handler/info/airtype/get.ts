import prisma from "../prisma.js";
import { Request,Response } from "express"

export async function GetAirTypeList(req:Request, res:Response) {
    let dbResult;
    if (req.query?.search) {
        dbResult = await prisma.$queryRawUnsafe(`SELECT id,type,manufacturer,sub_type FROM airtype WHERE is_delete = 0 AND sub_type LIKE '%${req.query.search}%' ORDER BY sub_type`);
    }else{
        dbResult = await prisma.$queryRawUnsafe('SELECT id,type,manufacturer,sub_type FROM airtype WHERE is_delete = 0 ORDER BY sub_type');
    }

    return res.json({airType: dbResult});
}
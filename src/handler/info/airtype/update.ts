import prisma from "../prisma.js";
import { Request,Response } from "express"

export async function UpdateAirtype(req:Request, res:Response) {

    let {sub_type} = req.params;
    try{
        await prisma.airtype.update({
            where: {sub_type: sub_type},
            data: req.body,
        });
    }catch{
        throw new Error('更新失败')
    }
    return res.end();

}
import prisma from "../prisma.js";
import { Request,Response } from "express"

export async function DeleteAircraftRecord(req:Request, res:Response) {
    const recordId = Number(req.params.id);
    // const result = await prisma.aircraft.update({
    //     where: {id: recordId},
    //     data: {is_delete: true},
    // });
    return res.json({message:"删除成功"});
}
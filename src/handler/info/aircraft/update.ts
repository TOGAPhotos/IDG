import prisma from "../prisma.js";
import { Request,Response } from "express"

export async function UpdateAircraftRecord(req:Request, res:Response) {
    /**
     * @todo 修改 UpdateAircraftRecord
     * */
    const recordId = Number(req.params.id);
    // const result = await prisma.aircraft.update({
    //     where: {id: recordId},
    //     data: req.body,
    // });
    return res.end();
}
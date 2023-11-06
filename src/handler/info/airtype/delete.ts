import prisma from "../prisma.js";
import { Request,Response } from "express"

export async function DeleteAirtype(req:Request, res:Response) {
    await prisma.airtype.delete({
        where: {sub_type: req.params.sub_type},
    });
    return res.end();
}
import prisma from "../prisma.js";
import { Request,Response } from "express"

export async function CreateAirtype(req:Request, res:Response) {
    let {type, sub_type, manufacturer} = req.body;

    await prisma.airtype.create({
        data: {type: type, sub_type: sub_type, manufacturer: manufacturer},
    });

    return res.end();
}
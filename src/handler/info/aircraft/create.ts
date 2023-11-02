import prisma from "../prisma.js";
import { Request,Response } from "express"
// import { CheckPromisResult } from "../../../components/promise-check.js";

export async function CreateAircraftRecord(req:Request, res:Response) {
    const result = await prisma.aircraft.create({data: req.body});
    return res.json({message:"创建成功"});
}
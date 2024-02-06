import prisma from "./prisma.js";
import { Request,Response } from "express"
import {RejectQueue} from "../queue/reject.js";

export async function UpdateUserInfo(req:Request, res:Response) {
    const userId = Number(req.params.id);
    if(req.query['action'] === 'delQueue' && req.role >= USER_ROLE.seniorScreener){
        return RejectQueue(req,res);
    }
    await prisma.user.update({
        where: {id: userId},
        data: req.body,
    });
    return res.end();
}
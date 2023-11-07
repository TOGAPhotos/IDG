import prisma from "./prisma.js";
import { Request,Response } from "express"

export async function DeleteUser(req:Request, res:Response) {
    const userId = Number(req.params.id);
    await prisma.user.update({
        where: {id: userId},
        data: {
            is_deleted: true,
        },
    });
    return res.end();
}
import prisma from "./prisma.js";
import { Request,Response } from "express"

export async function DeleteVote(req:Request, res:Response) {
    const vote = await prisma.vote_list.findUnique({where: {id: Number(req.params.id)}});
    
    if (vote === null) {
        return res.status(400).json({message: "投票不存在"});
    }

    await prisma.$queryRawUnsafe(`UPDATE photo SET vote = null WHERE vote = ${vote.id} `);
    await prisma.vote_list.update({
        where: {
            id: vote.id
        },
        data: {
            is_delete: true
        }
    });

    res.json({message: '删除成功'})
}
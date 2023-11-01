import prisma from "./prisma.js";
import { Request, Response } from "express"
// import CalculateVote from "./calculate.js";

export async function GetVote(req: Request, res: Response) {
    const vote = await prisma.vote_list.findUnique({ where: { id: Number(req.params.id) } });
    if (vote === null) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ message: "投票不存在" });
    }

    vote['behaviour'] = await prisma.vote_behaviour.findMany({
        where: {
            vote_event: vote.id,
        }
    });
    res.json({ message: '查询成功', data: vote })
}

export async function GetVoteList(req: Request, res: Response) {
    const voteList = await prisma.vote_list.findMany({
        where: {
            is_delete: false,
        },
        
    })
    res.json({ message: '查询成功', data: voteList })

}
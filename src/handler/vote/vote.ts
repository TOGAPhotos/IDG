import prisma from "./prisma.js";
import { Request,Response } from "express"
import CalculateVote from "./calculate.js";
import {CheckUserStatus} from "../../components/auth/permissions.js";

export async function Vote(req:Request, res:Response) {

    const userInfo = await prisma.user.findUnique({where: {id: req.token.id}});

    if(CheckUserStatus(userInfo) === false){
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({message:"用户状态异常"})
    }

    /**
     * @todo 投票
     * */
    // const vote = await prisma.vote_list.findUnique({where: {id: Number(req.params.id)}});
    // if (vote === null) {
    //     return res.status(HTTP_STATUS.NOT_FOUND).json({message: "投票不存在"});
    // }
    //
    // const voteBehaviour = await prisma.vote_behaviour.findMany({
    //     where: {
    //         user: userInfo.id,
    //         vote_event: vote.id,
    //     }
    // })
    //
    // if (voteBehaviour.length !== 0) {
    //     return res.status(HTTP_STATUS.BAD_REQUEST).json({message: "已经投过票了"});
    // }
    //
    // let userTally = CalculateVote(userInfo.total_photo);
    //
    // await prisma.vote_behaviour.create({
    //     data: {
    //         user: userInfo.id,
    //         tally: userTally,
    //         vote_event: vote.id,
    //     }
    // });
    //
    // await prisma.$queryRawUnsafe(`UPDATE vote_list SET tally = tally + ${userTally} WHERE id = ${vote.id}`)

    res.json({message: '投票成功'})
}
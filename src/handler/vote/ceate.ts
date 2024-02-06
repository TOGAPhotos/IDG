import prisma from "./prisma.js";
import { Request,Response } from "express"
import CalculateVote from "./calculate.js";
import {User} from "../../dto/user.js";
import {CheckUserStatus} from "../../components/auth/user-check.js";


export async function CreateVote(req:Request,res:Response) {
    const userInfo = await User.getUserById(req.token.id);
    //const userInfo = await prisma.user.findUnique({where: {id: req.token.id}});

    if ( !CheckUserStatus(userInfo) ){
        return res.status(HTTP_STATUS.FORBIDDEN).json({message: "您暂时不能发起投票"});
    }
    
    if ( !(userInfo.total_photo > 20 || userInfo.role >= USER_ROLE.screener) ) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({message: "您暂时不能发起投票"});
    }

    const photoId = Number(req.body.photo_id)
    if(isNaN(photoId)){
        return res.status(HTTP_STATUS.BAD_REQUEST).json({message: "参数错误"});
    }

    const photo = await prisma.photo.findUnique({
        where: {
            id: photoId
        }
    });

    if(photo.is_delete){
        return res.status(HTTP_STATUS.NOT_FOUND).json({message: "图片不存在"});
    }

    if (photo.vote !== null) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({message: "该图片已经有投票了"});
    }

    let tally = CalculateVote(userInfo.total_photo);
    const vote = await prisma.vote_list.create({
        data:{
            user:userInfo.id,
            photo_id:photoId,
            title:null,
            tally:tally,
        }
    })



    await Promise.allSettled([
        prisma.photo.update({
            where: {
                id: photoId
            },
            data: {
                vote: vote.id
            }
        }),
        prisma.vote_behaviour.create({
            data: {
                user: userInfo.id,
                tally: tally,
                vote_event: vote.id,
            }
        })
    ])

    res.json({message: '创建成功', data: vote})
}
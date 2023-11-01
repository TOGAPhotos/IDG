import prisma from "./prisma.js";
import { Request,Response } from "express"
import CalculateVote from "./calculate.js";
export async function CreateVote(req:Request,res:Response) {
    const userInfo = await prisma.user.findUnique({where: {id: req.token.id}});
    if (userInfo.status !== 0) {
        return res.status(401).json({message: "用户已暂停"});
    }

    if (userInfo.is_deleted) {
        return res.status(401).json({message: "用户已注销"});
    }
    
    if (userInfo.total_photo < 5) {
        return res.status(401).json({message: "权限不足"});
    }

    const photoId = Number(req.body.photo_id)
    if(isNaN(photoId)){
        return res.status(400).json({message: "参数错误"});
    }

    const photo = await prisma.photo.findUnique({
        where: {
            id: photoId
        }
    });

    if(photo.is_delete){
        return res.status(404).json({message: "图片不存在"});
    }

    if (photo.vote !== null) {
        return res.status(400).json({message: "该图片已经有投票了"});
    }

    let tally = CalculateVote(userInfo.total_photo);
    const vote = await prisma.vote_list.create({
        data:{
            user:userInfo.id,
            photo_id:photoId,
            title:null,
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
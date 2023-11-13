import prisma from "../prisma.js";
import { Request,Response } from "express"
import { CheckPromiseResult } from "../../../components/promise-check.js";

export async function CreateAirline(req:Request, res:Response) {
    let add_user = req.token.id;

    const jobList = await Promise.allSettled([
        prisma.airline.findMany({
            where: {
                add_user: add_user,
                wait_for_review: true,
                is_delete: false
            }
        }),
        prisma.user.findUnique({where: {id: add_user}})

    ])

    const resList = CheckPromiseResult(jobList);

    const preCheckResult = resList[0];
    const user = resList[1];


    if (preCheckResult.length > 0) { 
        return res.status(400).json({message: '添加失败，您的添加的上一条数据还没有完成审核'});
    }


    if(req.body.wait_for_review === undefined){
        req.body.wait_for_review = true
    }

    if(user.role === 0){
        req.body.wait_for_review = true
    }


    let message = req.body.wait_for_review ? '申请已提交' : '添加成功'

    await prisma.airline.create({
        data:{
            airline_en_name: req.body?.airline_en_name,
            airline_cn_name: req.body?.airline_cn_name,
            iata: req.body?.iata,
            icao: req.body?.icao,
            wait_for_review: req.body.wait_for_review,
            add_user: add_user
        }
    });

    return res.json({message})
}
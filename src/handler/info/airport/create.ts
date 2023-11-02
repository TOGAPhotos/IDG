import prisma from "../prisma.js";
import { Request,Response } from "express"
import { CheckPromisResult } from "../../../components/promise-check.js";

export async function CreateAirport(req:Request, res:Response) {
    // 检查用户是否有其他待审核的记录
    let add_user = req.token.id;

    const jobList = await Promise.allSettled([
        prisma.airport.findMany({
            where: {
                add_user: add_user,
                wait_for_review: true,
                is_delete: false
            }
        }),
        prisma.user.findUnique({where: {id: add_user}})

    ])

    const resList = CheckPromisResult(jobList)
    const preCheckResult = resList[0];
    const user = resList[1];

    if (preCheckResult.length > 0) {
        return res.status(400).json({message: '添加失败，您的添加的上一条数据还没有完成审核'});
    }

    //新增数据
    let {iata, icao, cn_name, wait_for_review} = req.body;

    if(wait_for_review === undefined){
        wait_for_review = true
    }

    let message = wait_for_review ? '申请已提交' : '添加成功'

    if (user.role === 0) {
        wait_for_review = true;
        message = '申请已提交'
    }

    await prisma.airport.create({
        data: {
            iata: iata,
            icao: icao,
            cn_name: cn_name,
            add_user: add_user,
            wait_for_review: wait_for_review
        },
    });

    return res.json({message});
}
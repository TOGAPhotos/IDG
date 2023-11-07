import prisma from "./prisma.js";
import { Request,Response } from "express"

export async function SearchUser(req:Request,res:Response){
    let {keyword} = req.params;

    const dbResult = await prisma.$queryRawUnsafe(`
        SELECT id,
               username,
               user_email,
               role,
               -- passing_rate,
               total_queue,
               free_queue,
               priority_queue,
               free_priority_queue,
               total_photo,
               status,
               suspension_days
               -- create_time
        FROM user
        WHERE is_deleted = 0
        AND (username LIKE '%${keyword}%'
            OR user_email LIKE '%${keyword}%')
        ORDER BY id
        DESC`
    )
    return res.json({message: '查询成功', data: dbResult});
}
import prisma from "./prisma.js";
import { Request,Response } from "express"

export async function GetQueueTop(req:Request,res:Response){
    let sql:string;
    const _cursor = req.query['cursor'] || 0
    if(req.role >= USER_ROLE.seniorScreener){
        sql = `SELECT id
                FROM upload_queue
                WHERE 
                    id > ${_cursor} 
                  AND is_delete = 0 
                  AND screening = 0 
                  AND ((screener_2 IS null AND screener_1 != ${req.token.id})OR screener_1 is null)
                  AND user_id != ${req.token.id}
                ORDER BY id
                LIMIT 1`
    }else{
        sql = `SELECT id
               FROM upload_queue
               WHERE id > ${_cursor}
                 AND is_delete = 0
                 AND screening = 0
                 AND (screener_1 is null)
                 AND user_id != ${req.token.id}
               ORDER BY id
               LIMIT 1`
    }

    const dbRes = await prisma.$queryRawUnsafe(sql)
    const id = dbRes[0].id
    return res.json({message: "查询成功", result: id})
}

// export async function GetQueue(req:Request,res:Response){

// }
import prisma from "./prisma.js";
import { Request,Response } from "express"

let cursor = -1;
let excludeList = [];

async function GetUploadQueueCursor() {
    const dbRes = await  prisma.$queryRawUnsafe(`
        SELECT
            id
        FROM upload_queue
        WHERE
            is_delete = 0
          AND
            screener_2 IS null
        ORDER BY id
        LIMIT 1     
    `)
    cursor = dbRes[0].id
    return dbRes[0].id
}

export async function GetExcludeList(){
    cursor = await GetUploadQueueCursor()
    const dbRes:any[] = await prisma.$queryRawUnsafe(`SELECT id FROM upload_queue WHERE id > ${cursor} AND (is_delete = 1 OR screener_2 IS NOT null)`)
    
    excludeList = dbRes.map(obj => { return obj.id } )
}

export async function GetUploadQueue(req:Request, res:Response) {
    const photoQueue = await prisma.$queryRawUnsafe(
        `SELECT
                a.id AS queue_id,                
                queue,
                photo_id AS id,
                photo_url,
                airtype,
                reg,
                airline,
                icao,
                iata,
                cn_name
         FROM (SELECT queue, photo_id,id
               FROM upload_queue
               WHERE user_id = ${req.token.id} AND is_delete = 0 AND screener_2 IS NULL) AS a,
              photo b,
              airport c
         WHERE a.photo_id = b.id
           AND b.airport_info = c.id`
    )
    if(cursor === -1){
        await GetExcludeList()
    }
    res.success('查询成功',{cursor, photoQueue,excludeList})
}
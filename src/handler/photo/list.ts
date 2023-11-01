import prisma from "./prisma.js";
import { Request,Response } from "express";


export async function GetFullList(req:Request, res:Response){

    let lastId = Number(req.query['lastId']);
    if(isNaN(lastId)){
        lastId = -1;
    }
    let lastIdSql = '';
    
    if (lastId !== -1 ) {
        lastIdSql = `AND a.id < ${lastId}`;
    }


    const result = await prisma.$queryRawUnsafe(`
        SELECT q.id,
               photo_url,
               q.reg,
               q.airtype,
               q.airline,
               q.uploader,
               q.airport_info,
               q.username,
               ap.iata,
               ap.icao,
               ap.cn_name
        FROM (SELECT a.id,
                     photo_url,
                     a.reg,
                     a.airtype,
                     a.airline,
                     a.uploader,
                     a.airport_info,
                     b.username
              FROM photo AS a,
                   user AS b
              WHERE is_delete = 0 ${lastIdSql}
                AND in_upload_queue = 0
                AND result = 1
                AND b.id = a.uploader
              ORDER BY a.id
                      DESC
              LIMIT 100) AS q
                 LEFT JOIN airport AS ap ON q.airport_info = ap.id

    `);
    return res.json({message:'查询成功',data:result});
}
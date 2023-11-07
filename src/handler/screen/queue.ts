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

export async function GetRecentScreenedQueue(req:Request, res:Response) {
  const result = await prisma.$queryRawUnsafe(`
      SELECT a.photo_url,
             b.id AS queue_id,
             b.result,
             b.reason,
             b.screener_message,
             b.need_screener_2,
             c.username AS screener_1,
             d.username AS screener_2,
             e.username AS uploader
      FROM photo a,
           upload_queue b,
           user c,
           user d,
           user e
      WHERE in_upload_queue = 0
        AND a.is_delete = 0
        AND a.id = b.photo_id
        AND e.id = a.uploader
        AND c.id = b.screener_1
        AND d.id = b.screener_2
      ORDER BY last_screen_time DESC
      LIMIT 200
  `);
  return res.json({message: "查询成功", result});
}

export async function GetRejectQueue(req:Request, res:Response) {
  const result = await prisma.$queryRawUnsafe(`
      SELECT a.id,
             a.photo_url,
             b.reason,
             b.screener_message
      FROM photo a,
           upload_queue b
      WHERE a.uploader = ${req.token.id}
        AND a.in_upload_queue = 0
        AND a.result = 0
        AND b.photo_id = a.id
      ORDER BY a.id
              DESC
      LIMIT 10
  `);
  return res.json({message: "查询成功", rejectQueue: result});
}

export async function GetScreenQueue(req:Request, res:Response) {

  let normalQueue = await prisma.$queryRawUnsafe(`
      SELECT a.id,
             a.need_screener_2,
             photo_url,
             c.username AS uploader,
             a.screener_1 AS screener_1_id,
             d.username AS screener_1,
             screening,
             reg,
             airtype,
             b.remark,
             airline,
             e.icao,
             e.iata,
             e.cn_name
      FROM (SELECT*
            FROM upload_queue
            WHERE is_delete = 0
              AND queue = 'normal'
              AND screener_2 IS NULL
              AND user_id != ${req.token.id}) AS a
               LEFT JOIN user AS d ON d.id = a.screener_1,
           photo b,
           user c,
           airport e
      WHERE b.id = a.photo_id
        AND c.id = a.user_id
        AND e.id = b.airport_info
  `);

  let priorityQueue = await prisma.$queryRawUnsafe(`
      SELECT a.id,
             photo_url,
             c.username AS uploader,
             d.username AS screener_1,
             reg,
             airtype,
             b.remark,
             airline,
             e.icao,
             e.iata,
             e.cn_name,
             screening
      FROM (SELECT*
            FROM upload_queue
            WHERE is_delete = 0
              AND queue = 'priority'
              AND screener_2 IS NULL
              AND user_id != ${req.token.id}) AS a
               LEFT JOIN user AS d ON d.id = a.screener_1,
           photo b,
           user c,
           airport e
      WHERE b.id = a.photo_id
        AND c.id = a.user_id
        AND e.id = b.airport_info
  `);

  return res.json({message: '查询成功', normalQueue, priorityQueue});
}
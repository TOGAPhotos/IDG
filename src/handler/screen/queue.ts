import prisma from "./prisma.js";
import { Request,Response } from "express"


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
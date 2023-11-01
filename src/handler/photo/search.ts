import { Request,Response } from "express";
import prisma from "./prisma.js";

export async function SearchPhoto(req:Request, res:Response) {
    const type = req.query['type'];
    const keyWord = req.query['keyword'];
    let lastId:number = Number(req.query['lastId']);

    if(isNaN(lastId)){
        lastId = -1;
    }
    // const defRegExp = new RegExp('--')
    // if (defRegExp.test(keyWord)) {
    //     throw new Error('keyWord');
    // }
    let lastIdSql = '';
    if (lastId !== -1) {
        lastIdSql = `AND a.id < ${lastId}`;
    }

    let restrictSql = '';
    // let sql = '';

    switch (type) {
        // case 'all':
        //     restrictSql = `reg LIKE '%${keyWord}%' OR airline LIKE '%${keyWord}%'`;
        //     break;
        case 'reg':
            restrictSql = `reg LIKE '%${keyWord}%'`;
            break;
        case 'airline':
            restrictSql = `airline LIKE '%${keyWord}%'`;
            break;
        case 'airport':
            restrictSql = `airport_info IN (SELECT id FROM airport WHERE cn_name LIKE '%${keyWord}%' OR icao LIKE '%${keyWord}%' OR iata LIKE '%${keyWord}%')`;
            break;
        case 'user':
            restrictSql = `uploader IN (SELECT id FROM user WHERE username LIKE '%${keyWord}%')`
            break;
        default:
            throw new Error('Search Type');
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
                AND (${restrictSql})
                AND in_upload_queue = 0
                AND result = 1
                AND b.id = a.uploader
              ORDER BY a.update_time
                      DESC
              LIMIT 100) AS q
                 LEFT JOIN airport AS ap ON q.airport_info = ap.id
    `);
    return res.json({message: '查询成功', data: result});

}
import prisma from "../prisma.js";
import {ConvertSqlValue} from '../../../components/sql.js'
import airlineSearchCache from "./cache.js";
import { Request,Response } from "express"


export async function SearchAirline(req:Request, res:Response) {
    let { keyword } = req.params;
    keyword = ConvertSqlValue(keyword)
    let cache = airlineSearchCache.get(keyword);
    if(cache){
        return res.json({message: '查询成功', airline: cache});
    }

    let result
    try{
        result = await prisma.$queryRawUnsafe(`
        SELECT id, airline_cn_name, airline_en_name, icao, iata
        FROM airline
        WHERE (
                    iata LIKE '%${keyword}%'
                OR icao LIKE '%${keyword}%'
                OR airline_cn_name LIKE '%${keyword}%'
                OR airline_en_name LIKE '%${keyword}%'
            )
          AND is_delete = false
    `)
    }catch{
        throw new Error('查询错误')
    }
    airlineSearchCache.set(keyword,result)
    return res.json({message: '查询成功', airline: result});
}

export async function GetAirlineList(req:Request, res:Response) {
    const dbResult = await prisma.$queryRawUnsafe(`
        SELECT id, airline_cn_name, airline_en_name, icao, iata
        FROM airline
        WHERE is_delete = false
    `);

    if (req.query?.type === 'full') {
        const reviewList = await prisma.airline.findMany({
            select: {
                icao: true,
                iata: true,
                airline_cn_name: true,
                airline_en_name: true,
                id: true,
            },
            where: {
                wait_for_review: true,
                is_delete: false
            }
        });
        return res.json({airline: dbResult, reviewList});
    }

    return res.json({message: '查询成功', airline: dbResult});
}
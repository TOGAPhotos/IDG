import prisma from "../prisma.js";
import { Request,Response } from "express"
import { ConvertSqlValue } from "../../../components/sql.js";

export async function GerAirportList(req:Request,res:Response) {

    //不搜索时，返回列表
    if (!req.query?.search) {
        const dbResult = await prisma.$queryRawUnsafe(
            `SELECT icao, iata, cn_name, id
             FROM airport
             WHERE is_delete = false
               AND wait_for_review = false
            `);
        //type = full时返回值包括待审核列表
        if (req.query?.type === 'full') {
            const reviewList = await prisma.airport.findMany({
                select: {
                    icao: true,
                    iata: true,
                    cn_name: true,
                    id: true,
                },
                where: {
                    wait_for_review: true,
                    is_delete: false
                }
            });
            return res.json({airport: dbResult, reviewList});
        }

        return res.json({airport: dbResult});
    }
    else {
        const queryContent = ConvertSqlValue(req.query?.search);
        let queryCondition;
        if (queryContent.search(/[A-Z]+/) !== -1) {
            queryCondition = `(iata LIKE '%${queryContent}%' OR icao LIKE '%${queryContent}%')`;
        } else {
            queryCondition = `cn_name LIKE '%${queryContent}%'`;
        }

        const dbResult = await prisma.$queryRawUnsafe(`SELECT *
                                                   FROM airport
                                                   WHERE is_delete = false
                                                     AND ${queryCondition}`);

        return res.json({airport: dbResult});
    }

}

export async function GetAirport(req:Request,res:Response){
    const id = Number( req.params.id ) 
    if(isNaN(id)){
        throw new Error('参数错误')
    }
    const dbResult = await prisma.airport.findUnique({
        where: {
            id: id,
        }
    });
    if(dbResult.is_delete){
        return res.status(HTTP_STATUS.NOT_FOUND).json({message:'机场已删除'})
    }
    return res.json({message:'查询成功',airport: dbResult});
}
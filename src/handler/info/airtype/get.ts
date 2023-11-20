import prisma from "../prisma.js";
import { Request,Response } from "express"
import { Logger } from "../../../components/loger.js";
import {ConvertSqlValue} from "../../../components/sql.js";

async function SearchAirType(keyWord:string) {
    let result = null;
    try{
        keyWord = ConvertSqlValue(keyWord);
        result = await prisma.$queryRawUnsafe(`SELECT id,type,manufacturer,sub_type FROM airtype WHERE is_delete = 0 AND sub_type LIKE '%${keyWord}%' ORDER BY sub_type`);
    }catch(e){
        Logger.error(`${e.message}\n${keyWord} 搜索失败`);
    }
    return result;
}

export async function GetAirTypeList(req:Request, res:Response) {
    let dbResult: unknown;
    if (req.query?.search) {
        dbResult = await SearchAirType(<string>req.query.search);
    }else{
        dbResult = await prisma.$queryRawUnsafe('SELECT id,type,manufacturer,sub_type FROM airtype WHERE is_delete = 0 ORDER BY sub_type');
    }

    return res.json({airType: dbResult});
}
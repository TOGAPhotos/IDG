import { Request, Response } from 'express';
import SearchCache from "../../service/redis/searchCache.js";
import {Airtype} from "../../dto/airtype.js";
import {REDIS_DB} from "../../service/redis/distribute.js";

export default class AirtypeHandler{

    static searchCache = new SearchCache(REDIS_DB.AIRTYPE_SEARCH_CACHE);
    static async create(req:Request, res:Response){
        const { type, subType, manufacturerCn, manufacturerEn } = req.body;
        await Airtype.create(type, subType, manufacturerCn, manufacturerEn);
        res.json({message: '创建成功'});
        await AirtypeHandler.searchCache.flush();
    }

    static async getList(req:Request, res:Response){
        if(req.query?.search) {
            const keyword = req.query['search'] as string;
            let result = await AirtypeHandler.searchCache.get(keyword);
            if(result === null){
                result = await Airtype.searchByKeyword(keyword);
            }
            res.json({message:'查询成功',type: result});
            await AirtypeHandler.searchCache.set(keyword, result);
        }else{
            const dbResult = await Airtype.getList();
            return res.json({message: '查询成功', data: dbResult});
        }
    }

    static async delete(req:Request, res:Response){
        const subType = req.params.subType;
        await Airtype.delete(subType);
        res.json({message: '删除成功'});
        await AirtypeHandler.searchCache.flush();
    }

    static async update(req:Request, res:Response){
        const subType = req.params["sub_type"] as string;
        await Airtype.update(subType, req.body);
        res.json({message: '更新成功'});
        await AirtypeHandler.searchCache.flush();
    }
}
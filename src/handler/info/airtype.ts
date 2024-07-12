import { Request, Response } from 'express';
import SearchCache from "../../service/redis/searchCache.js";
import {Airtype} from "../../dto/airtype.js";
import {REDIS_DB} from "../../service/redis/distribute.js";

export default class AirtypeHandler{

    static searchCache = new SearchCache(REDIS_DB.AIRTYPE_SEARCH_CACHE);
    static async create(req:Request, res:Response){
        const { type, subType, manufacturerCn, manufacturerEn } = req.body;
        await Airtype.create(type, subType, manufacturerCn, manufacturerEn);
        res.success('创建成功');
        await AirtypeHandler.searchCache.flush();
    }

    static async getList(req:Request, res:Response){
        if(req.query?.search) {
            const keyword = req.query['search'] as string;
            let result = await AirtypeHandler.searchCache.get(keyword);
            if(result === null){
                result = await Airtype.searchByKeyword(keyword);
            }
            res.success('查询成功', result);
            await AirtypeHandler.searchCache.set(keyword, result);
        }else{
            const dbResult = await Airtype.getList();
            res.success('查询成功', dbResult);
        }
    }

    static async delete(req:Request, res:Response){
        const subType = req.params.subType;
        await Airtype.delete(subType);
        res.success('删除成功');
        await AirtypeHandler.searchCache.flush();
    }

    static async update(req:Request, res:Response){
        const subType = req.params["sub_type"] as string;
        await Airtype.update(subType, req.body);
        res.success('更新成功');
        await AirtypeHandler.searchCache.flush();
    }
}
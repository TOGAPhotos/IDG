import {Request, Response} from "express";
import SearchCache from "../../service/redis/searchCache.js";
import {REDIS_DB} from "../../service/redis/distribute.js";
import {Aircraft} from "../../dto/aircraft.js";
import { HTTP_STATUS } from "../../../types/http_code.js";

export default class AircraftHandler{
    static searchCache = new SearchCache(REDIS_DB.AIRPORT_SEARCH_CACHE);

    static async delete(req:Request,res:Response){
        const AircraftId = Number(req.params.id);
        await Aircraft.delete(AircraftId);
        res.json({message: '删除成功'});
        await AircraftHandler.searchCache.flush();
    }

    static async search(req:Request,res:Response){
        const keyword = req.query.reg as string;
        let result = await AircraftHandler.searchCache.get(keyword);
        if(result === null){
            result = await Aircraft.searchByKeyword(keyword);
            res.success('查询成功', result);
            await AircraftHandler.searchCache.set(keyword, result);
        }else{
            res.success('查询成功', result);
        }
    }

    static async get(req:Request,res:Response){
        const dbResult = await Aircraft.getById(Number(req.params.id));
        if (dbResult === null) {
            res.fail(HTTP_STATUS.NOT_FOUND, '飞机记录不存在')
        }
        res.success('查询成功', dbResult);
    }


    // static async list(req:Request,res:Response){
    //     const dbResult = await Aircraft.getAircraftList();
    //     return res.json({message: '查询成功', data: dbResult});
    // }

    static async create(req:Request,res:Response){
        const {reg, msn,ln, airlineId, remark} = req.body;
        const result = await Aircraft.create(reg, msn,ln, airlineId, remark);
        res.json({message: '创建成功', data: result});
        await AircraftHandler.searchCache.flush();
    }

    static async update(req:Request,res:Response){
        const id = Number(req.params["id"]);
        const result = await Aircraft.update(id, req.body);
        res.json({message: '更新成功', data: result});
        await AircraftHandler.searchCache.flush();
    }
}
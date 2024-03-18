import {Request, Response} from "express";
import SearchCache from "../../service/redis/searchCache.js";
import {REDIS_DB} from "../../service/redis/distribute.js";
import {Aircraft} from "../../dto/aircraft.js";

export default class AircraftHandler{
    static searchCache = new SearchCache(REDIS_DB.AIRPORT_SEARCH_CACHE);

    static async delete(req:Request,res:Response){
        const AircraftId = Number(req.params.id);
        await Aircraft.delete(AircraftId);
        res.json({message: '删除成功'});
        await this.searchCache.flush();
    }

    static async search(req:Request,res:Response){
        let result = await this.searchCache.get(<string>req.query.search);
        if(result === null){
            result = await Aircraft.searchByKeyword(<string>req.query.search);
            res.json({aircraft: result});
            await this.searchCache.set(<string>req.query.search, result);
        }else{
            res.json({data: result});
        }
    }

    static async get(req:Request,res:Response){
        const dbResult = await Aircraft.getById(Number(req.params.id));
        if (dbResult === null) {
            return res.status(404).json({message: '飞机记录不存在'})
        }
        return res.json({message: '查询成功', data: dbResult});
    }

    // static async list(req:Request,res:Response){
    //     const dbResult = await Aircraft.getAircraftList();
    //     return res.json({message: '查询成功', data: dbResult});
    // }

    static async create(req:Request,res:Response){
        const {reg, msn,ln, airlineId, remark} = req.body;
        const result = await Aircraft.create(reg, msn,ln, airlineId, remark);
        return res.json({message: '创建成功', data: result});
    }

    static async update(req:Request,res:Response){
        const id = Number(req.params["id"]);
        const result = await Aircraft.update(Number(id), req.body);
        return res.json({message: '更新成功', data: result});
    }
}
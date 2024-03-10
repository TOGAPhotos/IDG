import { Request,Response } from "express"
import NotamCache from "./cache.js"
import Notam from "../../dto/notam.js";

const notamCache = new NotamCache();

export default class NotamHandler{
    static async get(req:Request,res:Response){
        const notam = notamCache.getCache();

        return res.json({
            message:'获取成功',
            id:notam.id,
            title:notam.title,
            content:notam.content
        })
    }

    static async create(req:Request,res:Response){
        const {title,content} = req.body;
        const userId = req.token.id;

        await Notam.create(title,content,userId);
        await notamCache.renewCache();

        return res.json({
            message:'创建成功'
        })
    }

}


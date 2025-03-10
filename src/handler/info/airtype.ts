import { Request, Response } from 'express';
import SearchCache from "../../service/redis/searchCache.js";
import User from "../../dto/user.js";
import {Airtype} from "../../dto/airtype.js";
import {REDIS_DB} from "../../service/redis/distribute.js";
import Permission from '../../components/auth/permissions.js';
import { HTTP_STATUS } from '../../types/http_code.js';
import MailTemp from "../../service/mail/mailTemp.js";

export default class AirtypeHandler{

    static searchCache = new SearchCache(REDIS_DB.AIRTYPE_SEARCH_CACHE);

    static async create(req:Request, res:Response){
        let status = 'WAITING';
        
        const user = await User.getById(req.token.id);
        
        if(Permission.isStaff(user.role)){
            status = 'AVAILABLE';
        }else if(await Airtype.createPreCheck(user.id)){
            return res.fail(HTTP_STATUS.FORBIDDEN,'您有待审核的机型信息，请等待审核结果');
        }

        const { type, sub_type, manufacturer_cn, manufacturer_en,icao_code } = req.body;
        await Airtype.create(manufacturer_cn, manufacturer_en,type, sub_type,icao_code,status,user.id);
        res.success('创建成功');
        if(Permission.isStaff(user.role)){
            await AirtypeHandler.searchCache.flush();
        }
    }

    static async search(req:Request, res:Response){
        if( !req.query?.search ){
            return res.fail(HTTP_STATUS.BAD_REQUEST, '请输入搜索关键字');
        }
        const keyword = req.query['search'] as string;
        let result = await AirtypeHandler.searchCache.get(keyword);
        if(result === null){
            result = await Airtype.searchByKeyword(keyword);
        }
        res.success('查询成功', result);
        await AirtypeHandler.searchCache.set(keyword, result);
        
    }

    static async get(req:Request, res:Response){
        const id = Number(req.params["id"]);
        const result = await Airtype.getById(id);
        res.success('查询成功', result);
    }

    static async list(req:Request, res:Response){
        const type = req.query.type as string;
        if(type === 'review'){
            const dbResult = await Airtype.getReviewList();
            return res.success('查询成功', {reviewList: dbResult});
        }
        const dbResult = await Airtype.getList();
        if(type === 'full'){
            const reviewList = await Airtype.getReviewList();
            return res.success('查询成功', {airtype: dbResult, reviewList});
        }else{
            return res.success('查询成功', {airtype: dbResult});
        }
    }

    static async delete(req:Request, res:Response){
        const id = Number(req.params.id);

        await Airtype.delete(id);
        res.success('删除成功');
        await AirtypeHandler.searchCache.flush();
    }

    static async update(req:Request, res:Response){
        const id = Number(req.params["id"])
        const { status } = req.query;
        if(status === 'AVAILABLE' || status === 'REJECT'){
            const airtypeInfo = await Airtype.update(id, {status:status});
            res.success('审核完成');
            const createUser = await User.getById(airtypeInfo.create_user);
            if(!Permission.checkUserStatus(createUser)){
                return;
            }
            // MailTemp.InfoReviewNotice(createUser.user_email, status, airtypeInfo.manufacturer_cn, airtypeInfo.type, airtypeInfo.sub_type);
        }else{
            await Airtype.update(id, req.body);
            res.success('更新成功');
        }
        await AirtypeHandler.searchCache.flush();
    }
}
import { Request,Response } from "express"
import {Airport} from "../../dto/airport.js";
import User from "../../dto/user.js";
import Permission from "../../components/auth/permissions.js";
import SearchCache from "../../service/redis/searchCache.js";
import MailTemp from "../../service/mail/mailTemp.js";
import {REDIS_DB} from "../../service/redis/distribute.js";
import { HTTP_STATUS } from "../../types/http_code.js";


export default class AirportHandler{

    static searchCache = new SearchCache(REDIS_DB.AIRPORT_SEARCH_CACHE);

    static async delete(req:Request,res:Response){
        const AirportId = Number(req.params.id);
        await Airport.delete(AirportId);
        res.success('删除成功');
        await AirportHandler.searchCache.flush();
    }

    static async get(req:Request,res:Response){
        const dbResult = await Airport.getById(Number(req.params.id));

        if (dbResult === null) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({message: '机场不存在'})
        }
        if(dbResult.is_delete){
            return res.status(HTTP_STATUS.NOT_FOUND).json({message: '机场已删除'})
        }

        res.success('查询成功', dbResult);
    }

    static async search(req:Request,res:Response){
        const keyword = req.query?.search as string;

        let result = await AirportHandler.searchCache.get(keyword);
        if(result === null){
            result = await Airport.searchByKeyword(keyword);
            await AirportHandler.searchCache.set(keyword, result);
        }
        res.success('查询成功', result);
    }

    static async list(req:Request,res:Response){

        if(req.query?.type === 'review'){
            const reviewList = await Airport.getReviewAirportList();
            return res.success('查询成功', {reviewList:reviewList});
        }
        
        const dbResult = await Airport.getAvailableAirportList();
        if(req.query?.type === 'full'){
            const reviewList = await Airport.getReviewAirportList();
            return res.success('查询成功', {airport: dbResult, reviewList:reviewList});
        }else{
            return res.success('查询成功', dbResult);
        }
    }

    static async create(req:Request,res:Response){
        const user = await User.getById(req.token.id);
        const {iata_code, icao_code, airport_cn,airport_en} = req.body;
        let status = 'WAITING';
        if(Permission.isStaff(user.role)){
            status = 'AVAILABLE';
        }else if(await  Airport.createPreCheck(user.id)){
            return res.fail(HTTP_STATUS.BAD_REQUEST, '添加失败，您的添加的上一条数据还没有完成审核');
        }
    
        const message = status === 'WAITING' ? '申请已提交' : '添加成功';

        await Airport.create(airport_cn,airport_en,iata_code, icao_code, user.id,status);

        res.success(message);

        if(status === 'AVAILABLE'){
            await AirportHandler.searchCache.flush();
        }
    }

    static async update(req:Request,res:Response){
        const airportId = Number(req.params.id);
        const { status } = req.query;
        if (status === 'AVAILABLE' || status === 'REJECT') {
            const airportInfo = await Airport.update(airportId, {status: status});
            res.success('审核完成');
            const createUser = await User.getById(airportInfo.create_user);
            if (!Permission.checkUserStatus(createUser)) {
                return;
            }
            // await MailTemp.InfoReviewNotice(createUser.user_email, status, airportInfo.airport_cn, airportInfo.iata_code, airportInfo.iata_code);

        }else{
            await Airport.update(airportId,req.body);
            res.success('更新成功');
        }
        await AirportHandler.searchCache.flush();
    }
}
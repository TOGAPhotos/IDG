import { Request,Response } from "express"
import {Airline} from "../../dto/airline.js";
import SearchCache from "../../service/redis/searchCache.js";
import User from "../../dto/user.js";
import Permission from "../../components/auth/permissions.js";
import MailTemp from "../../service/mail/mailTemp.js";
import {REDIS_DB} from "../../service/redis/distribute.js";
import { HTTP_STATUS } from "../../../types/http_code.js";

export default class AirlineHandler{

    static searchCache = new SearchCache(REDIS_DB.AIRLINE_SEARCH_CACHE);

    static async create(req:Request, res:Response){
        const { airline_cn, airline_en, icao_code, iata_code} = req.body;
        let status = 'WAITING';
        
        const user = await User.getById(req.token.id);

        if( Permission.isStaff( user.role) ){
            status = 'AVAILABLE';
        }else if ((await Airline.preCheck(user.id)).length > 0) {
            return res.fail(HTTP_STATUS.FORBIDDEN,'您有待审核的航空公司信息，请等待审核结果');
        }
        
        await Airline.create(airline_cn, airline_en, icao_code, iata_code, user.id, status);
        
        res.success("创建成功");

        if(status ==='AVAILABLE'){
            await AirlineHandler.searchCache.flush();
        }
    }

    static async search(req:Request, res:Response){
        const keyword = req.query?.search as string;

        let result = await AirlineHandler.searchCache.get(keyword);
        if(result === null){
            result = await Airline.searchByKeyword(keyword);
            await AirlineHandler.searchCache.set(keyword, result);
        }
        res.success('查询成功', result);
        
    }

    static async list(req:Request, res:Response){
        const dbResult = await Airline.getList();

        if (req.query?.type === 'full') {
            const reviewList = await Airline.getReviewList();
            return res.success('查询成功', {airline: dbResult, reviewList});
        }else{
            return res.json({message: '查询成功', airline: dbResult});
        }
    
    }

    static async delete(req:Request, res:Response){
        const airlineId = Number(req.params.id);
        await Airline.deleteById(airlineId);
        res.success('删除成功');
        await AirlineHandler.searchCache.flush();
    }

    static async update(req:Request, res:Response){
        const airlineId = Number(req.params.id);

        const { status } = req.query;
        if(status === 'AVAILABLE' || status === 'REJECT'){
            const airlineInfo = await Airline.update(airlineId, {status:status});
            res.success('审核完成');
            const createUser = await User.getById(airlineInfo.create_user);
            if(!Permission.checkUserStatus(createUser)){
                return;
            }
            MailTemp.InfoReviewNotice(createUser.user_email, status, airlineInfo.airline_cn, airlineInfo.icao_code, airlineInfo.iata_code);
        }else{
            await Airline.update(airlineId, req.body);
            res.json({message: '修改成功'});

        }
        await AirlineHandler.searchCache.flush();
    }

}
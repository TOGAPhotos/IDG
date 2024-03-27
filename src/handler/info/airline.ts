import { Request,Response } from "express"
import {Airline} from "../../dto/airline.js";
import SearchCache from "../../service/redis/searchCache.js";
import User from "../../dto/user.js";
import Permission from "../../components/auth/permissions.js";
import MailTemp from "../../service/mail/mailTemp.js";
import {REDIS_DB} from "../../service/redis/distribute.js";

export default class AirlineHandler{

    static searchCache = new SearchCache(REDIS_DB.AIRLINE_SEARCH_CACHE);

    static async create(req:Request, res:Response){
        const { airline_cn_name, airline_en_name, icao, iata,wait_for_review } = req.body;
        await Airline.create(airline_cn_name, airline_en_name, icao, iata,req.token.id,wait_for_review);
        res.json({message: '创建成功'});
        await AirlineHandler.searchCache.flush();
    }

    static async search(req:Request, res:Response){
        let { keyword } = req.params;

        let result = await AirlineHandler.searchCache.get(keyword);
        if(result === null){
            result = await Airline.searchByKeyword(keyword);
        }
        res.json({message: '查询成功', airline: result});
        await AirlineHandler.searchCache.set(keyword, result);
    }

    static async list(req:Request, res:Response){
        const dbResult = await Airline.getList();

        if (req.query?.type === 'full') {
            const reviewList = await Airline.getReviewList();
            return res.json({airline: dbResult, reviewList});
        }

        return res.json({message: '查询成功', airline: dbResult});
    }

    static async delete(req:Request, res:Response){
        const airlineId = Number(req.params.id);

        if(req.query["type"] === 'review'){
            const airlineInfo = await Airline.getById(airlineId);
            await Airline.verifyAirline(airlineId,'reject');
            res.json({message: '拒绝成功'});
            const userInfo = await User.getById(airlineInfo.add_user);
            if(Permission.checkUserStatus(userInfo)){
                await MailTemp.InfoReviewNotice(
                    userInfo['user_email'],
                    'reject',
                    airlineInfo['airline_cn_name'],
                    airlineInfo['icao'],
                    airlineInfo['iata']
                );
            }

        }else{
            await Airline.deleteById(airlineId);
            res.json({message: '删除成功'});
            await AirlineHandler.searchCache.flush();
        }

    }

    static async update(req:Request, res:Response){
        const id = Number(req.params.id);
        if(req.query["type"] === 'review'){
            await Airline.verifyAirline(id,'accept');
            res.json({message: '审核通过'});

            const userInfo= await User.getById(req.token.id);
            if(Permission.checkUserStatus(userInfo)){
                 await MailTemp.InfoReviewNotice(
                    userInfo['user_email'],
                    'accept',
                    req.body?.airline_cn_name,
                    req.body?.icao,
                    req.body?.iata
                );
            }

        }else{
            await Airline.update(id, req.body);
            res.json({message: '修改成功'});

        }

        await AirlineHandler.searchCache.flush();
    }

}
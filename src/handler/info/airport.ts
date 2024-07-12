import { Request,Response } from "express"
import {Airport} from "../../dto/airport.js";
import User from "../../dto/user.js";
import Permission from "../../components/auth/permissions.js";
import SearchCache from "../../service/redis/searchCache.js";
import MailTemp from "../../service/mail/mailTemp.js";
import {REDIS_DB} from "../../service/redis/distribute.js";


export default class AirportHandler{

    static searchCache = new SearchCache(REDIS_DB.AIRPORT_SEARCH_CACHE);

    static async delete(req:Request,res:Response){
        const AirportId = Number(req.params.id);
        if (req.query["type"] === 'review') {
             // 拒绝信息
             const airportInfo = await Airport.getById(AirportId);
             await Airport.verifyAirportInfo(AirportId, 'reject');

             const applicantUser = await User.getById(airportInfo.add_user);
                if(Permission.checkUserStatus(applicantUser)) {
                    await MailTemp.InfoReviewNotice(applicantUser.user_email, 'reject', airportInfo.airport_cn, airportInfo.iata_code, airportInfo.iata_code);
                }
        }
        await Airport.delete(AirportId);
        res.json({message: '删除成功'});
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

    static async list(req:Request,res:Response){
        if(req.query?.search){
            let result = await AirportHandler.searchCache.get(<string>req.query.search);
            console.log(result)
            if(result === null){
                result = await Airport.searchByKeyword(<string>req.query.search);
                console.log(result)
                res.json({airport: result});
                return AirportHandler.searchCache.set(<string>req.query.search, result);
            }else{
                res.success('查询成功', result);
            }

        }

        const dbResult = await Airport.getAvailableAirportList();

        if(req.query?.type === 'full'){
            const reviewList = await Airport.getReviewAirportList();
            res.success('查询成功', {airport: dbResult, reviewList});
        }

        res.success('查询成功', dbResult);
    }

    static async create(req:Request,res:Response){
        const userId = req.token.id;
        const user = await User.getById(userId);
        const preCheckResult:boolean = await  Airport.createPreCheck(userId);
        if(preCheckResult){
            return res.status(HTTP_STATUS.BAD_REQUEST).json({message: '添加失败，您的添加的上一条数据还没有完成审核'});
        }

        const {iata, icao, cn_name,en_name, wait_for_review} = req.body;

        const status = wait_for_review === undefined && Permission.isStaff(user.role) ? 'WAITING' : 'AVAILABLE';
        const message = status === 'WAITING' ? '申请已提交' : '添加成功';

        await Airport.create(cn_name,en_name,iata, icao, userId,status);

        res.json({message:message});

        if(status === 'AVAILABLE'){
            await AirportHandler.searchCache.flush();
        }
    }

    static async update(req:Request,res:Response){
        const airportId = Number(req.params.id);

        if (req.query["type"] === 'review') {
            await Airport.verifyAirportInfo(airportId, 'accept');
            const airportInfo = await Airport.getById(airportId);
            res.json({message: '审核通过'});

            const applicantUser = await User.getById(airportInfo.add_user);
            if(Permission.checkUserStatus(applicantUser)){
                await MailTemp.InfoReviewNotice(applicantUser.user_email, 'accept', airportInfo.airport_cn, airportInfo.iata_code, airportInfo.iata_code);
            }

        }else{
            await Airport.update(airportId,req.body);
            res.json({message: '修改成功'});
        }


        await AirportHandler.searchCache.flush();
    }
}
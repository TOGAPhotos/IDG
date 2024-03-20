import {PrismaClient} from '@prisma/client';
import {checkNumberParams} from "../components/decorators/checkNumberParams.js";
import {secureSqlString} from "../components/decorators/secureSqlString.js";

const prisma = new PrismaClient();

interface PhotoInfo {
    userId:number,
    uploadTime:Date,
    reg:string,
    msn:string,
    airline:number,
    airtype:string,
    airport:number,
    picType:string,
    photoTime:Date,
    remark:string,
    allowSocialMedia:boolean
}

export default class Photo {
    @checkNumberParams
    static async getById(id: number) {
        return prisma.full_photo_info.findUnique({where: {photo_id: id}});
    }

    @checkNumberParams
    static async getAcceptById(id:number){
        return prisma.accept_photo.findUnique({where:{photo_id:id}})
    }

    @checkNumberParams
    static async getByUserId(userId:number){
        return prisma.accept_photo.findMany({where:{upload_user_id:userId}});
    }

    @checkNumberParams
    static async deleteById(id: number) {
        try {
            await prisma.photo.update({where: {id: id}, data: {is_delete: true}});
            await prisma.photo_queue.update({where: {photo_id: id}, data: {is_delete: true}});
        } catch (e) {
            console.error(e);
            await prisma.photo.update({where: {id: id}, data: {is_delete: false}});
            await prisma.photo_queue.update({where: {photo_id: id}, data: {is_delete: false}});
            throw new Error("删除失败");
        }
        return
    }

    @secureSqlString
    static async searchByRegKeyword(keyword: string,lastId:number) {
        if(lastId === -1){
            return prisma.accept_photo.findMany({where: {ac_reg: {contains: keyword}}});
        }else{
            return prisma.accept_photo.findMany({where: {ac_reg: {contains: keyword},photo_id:{lt:lastId}}});
        }
    }

    @secureSqlString
    static async searchByAirlineKeyword(keyword: string,lastId:number) {
        if(lastId === -1){
            return prisma.accept_photo.findMany({where: {OR: [{airline: {contains: keyword}}]}});
        }else{
            return prisma.accept_photo.findMany({where: {OR: [{airline: {contains: keyword}}], photo_id:{lt:lastId}}});
        }
    }

    @secureSqlString
    static async searchByAirportKeyword(keyword: string,lastId:number) {
        if(lastId === -1){
        return prisma.accept_photo.findMany({
            where: {
                OR: [
                    {airport_cn: {contains: keyword}},
                    {airport_en: {contains: keyword}},
                    {airport_iata_code: {contains: keyword}},
                    {airport_icao_code: {contains: keyword}}
                ]
            }
        });
        }else{
            return prisma.accept_photo.findMany({
                where: {
                    OR: [
                        {airport_cn: {contains: keyword}},
                        {airport_en: {contains: keyword}},
                        {airport_iata_code: {contains: keyword}},
                        {airport_icao_code: {contains: keyword}}
                    ],
                    photo_id:{lt:lastId}
                }
            });
        }
    }

    @secureSqlString
    static async searchByUserKeyword(keyword: string,lastId:number) {
        if(lastId === -1){
            return prisma.accept_photo.findMany({where: {username: {contains: keyword}}});
        }else{
            return prisma.accept_photo.findMany({where: {username: {contains: keyword},photo_id:{lt:lastId}}});
        }

    }

    static async create(data:PhotoInfo){
         return prisma.photo.create({
            data:{
                upload_user_id: data.userId,
                upload_time:data.uploadTime,
                ac_reg:data.reg,
                ac_msn:data.msn,
                airline:"data.airline",
                ac_type:data.airtype,
                airport_id:data.airport,
                pic_type:data.picType,
                photo_time:data.photoTime,
                // remark:data.remark,
                // allow_social_media:data.allowSocialMedia
            }
        })
    }

}
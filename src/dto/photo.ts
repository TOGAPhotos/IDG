import {PrismaClient} from '@prisma/client';
import {checkNumberParams} from "../components/decorators/checkNumberParams.js";
import {secureSqlString} from "../components/decorators/secureSqlString.js";

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
    private static prisma = new PrismaClient();

    @checkNumberParams
    static async getById(id: number) {
        return this.prisma.full_photo_info.findUnique({where: {photo_id: id}});
    }

    @checkNumberParams
    static async getAcceptById(id:number){
        return this.prisma.accept_photo.findUnique({where:{id:id}})
    }

    @checkNumberParams
    static async getByUserId(userId:number){
        return this.prisma.accept_photo.findMany({where:{upload_user_id:userId}});
    }

    @checkNumberParams
    static async deleteById(id: number) {
        try {
            await this.prisma.photo.update({where: {id: id}, data: {is_delete: true}});
            await this.prisma.photo_queue.update({where: {photo_id: id}, data: {is_delete: true}});
        } catch (e) {
            console.error(e);
            await this.prisma.photo.update({where: {id: id}, data: {is_delete: false}});
            await this.prisma.photo_queue.update({where: {photo_id: id}, data: {is_delete: false}});
            throw new Error("删除失败");
        }
        return
    }

    static async getAcceptPhotoList(lastId:number,num:number) {
        if(lastId === -1){
            return this.prisma.accept_photo.findMany({
                take:num,
                orderBy:{upload_time:'desc'}
            })
        }else{
            return this.prisma.accept_photo.findMany(
                {
                    where: {
                        id: {lt:lastId}
                    },
                    take:num,
                    orderBy:{upload_time:'desc'}
            })
        }
    }

    // @secureSqlString
    static async searchByRegKeyword(keyword: string,lastId:number,num:number) {
        lastId = Number(lastId)
        if(lastId === -1){
            return this.prisma.accept_photo.findMany({
                where: {
                    ac_reg: {contains: keyword}
            },
            orderBy:{upload_time:'desc'},
            take:num
        });
        }else{
            return this.prisma.accept_photo.findMany({
                where: {
                    ac_reg: {contains: keyword},
                    id:{lt:lastId}
                },
                take:num,
                orderBy:{upload_time:'desc'}
            });
        }
    }

    // @secureSqlString
    // static async searchByAirlineKeyword(keyword: string,lastId:number) {
    //     lastId = Number(lastId)
    //     if(lastId === -1){
    //         return this.prisma.accept_photo.findMany({where: {OR: [{airline_en_name: {contains: keyword}},{airline_cn_name: {contains: keyword}}]},orderBy:{upload_time:'desc'}});
    //     }else{
    //         return this.prisma.accept_photo.findMany({where: {OR: [{airline_en_name: {contains: keyword}},{airline_cn_name: {contains: keyword}}], photo_id:{lt:lastId}},orderBy:{upload_time:'desc'}});
    //     }
    // }

    static async searchByAirtypeKeyword(keyword: string,lastId:number,num:number) {
        lastId = Number(lastId)
        if(lastId === -1){
            return this.prisma.accept_photo.findMany({
                where: {
                    ac_type: {contains: keyword}
                },
                take:num,
                orderBy:{upload_time:'desc'}
            });
        }else{
            return this.prisma.accept_photo.findMany({
                where: {
                    ac_type: {contains: keyword},
                    id:{lt:lastId}
                },
                take:num,
                orderBy:{upload_time:'desc'}
            });
        }
    }

    
    static async searchByAirportKeyword(keyword: string,lastId:number,num:number) {
        lastId = Number(lastId)
        if(lastId === -1){
        return this.prisma.accept_photo.findMany({
            where: {
                OR: [
                    {airport_cn: {contains: keyword}},
                    {airport_en: {contains: keyword}},
                    {airport_iata_code: {contains: keyword}},
                    {airport_icao_code: {contains: keyword}}
                ]
            },
            orderBy:{upload_time:'desc'},
            take:num,
        });
        }else{
            return this.prisma.accept_photo.findMany({
                where: {
                    OR: [
                        {airport_cn: {contains: keyword}},
                        {airport_en: {contains: keyword}},
                        {airport_iata_code: {contains: keyword}},
                        {airport_icao_code: {contains: keyword}}
                    ],
                    id:{lt:lastId}
                },
                orderBy:{upload_time:'desc'},
                take:num
            });
        }
    }

    // @secureSqlString
    static async searchByUserKeyword(keyword: string,lastId:number,num:number) {
        lastId = Number(lastId)
        if(lastId === -1){
            return this.prisma.accept_photo.findMany({
                where: {
                    username: {contains: keyword}
                },
                orderBy:{upload_time:'desc'},
                take:num
            });
        }else{
            return this.prisma.accept_photo.findMany({
                where: {username: 
                    {contains: keyword},
                    id:{lt:lastId}
                },
                orderBy:{upload_time:'desc'},
                take:num
            });
        }

    }

    static async create(data:PhotoInfo){
         return this.prisma.photo.create({
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

    static async update(id:number,data:any){
        this.prisma.photo.update({where: {id: id}, data: data})
    }

}
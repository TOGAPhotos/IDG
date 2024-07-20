import {PrismaClient} from '@prisma/client';

import {secureSqlString} from "../components/decorators/secureSqlString.js";
import { stat } from 'fs';
const prisma = new PrismaClient();
export class Airtype{
    @secureSqlString
    static async searchByKeyword(keyword:string) {
        return prisma.airtype.findMany({
            where:{sub_type:{contains:keyword}},
            orderBy:{sub_type:'asc'}}
        );
    }

    static async getById(id:number) {
        return prisma.airtype.findUnique({where:{id:id}});
    }

    static async createPreCheck(userId:number) {
        const res = await prisma.airtype.findMany({
            where:{
                create_user:userId,
                status:'WAITING',
            }
        });
        return res.length > 0;
    }

    @secureSqlString
    static async create(manufacturerCn:string,manufacturerEn:string,type:string,subType:string,icao:string,status:string) {
        await prisma.airtype.create({
            data: {
                manufacturer_cn: manufacturerCn, 
                manufacturer_en: manufacturerEn,
                type: type, 
                sub_type: subType,
                icao_code:icao,
                status:status as 'AVAILABLE'|'WAITING',
            },
        });
    }

    static async getReviewList() {
        return prisma.airtype.findMany({where:{status:'WAITING'},orderBy:{sub_type:'asc'}});
    }

    static async getList() {
        return prisma.airtype.findMany({orderBy:{sub_type:'asc'}});
    }

    @secureSqlString
    static async delete(subType:string) {
        await prisma.airtype.delete({where:{sub_type:subType}});
    }

    static async update(id:number, data:any) {
        return await prisma.airtype.update({where:{id:id},data:data});
    }

}
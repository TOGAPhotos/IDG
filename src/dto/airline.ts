import {PrismaClient} from '@prisma/client';
import {secureSqlString} from "../components/decorators/secureSqlString.js";
import {checkNumberParams} from "../components/decorators/checkNumberParams.js";
const prisma = new PrismaClient();

export class Airline{

    @secureSqlString
    static async searchByKeyword(keyword:string) {
        try{
            return await prisma.$queryRawUnsafe(`
            SELECT id, airline_cn_name, airline_en_name, icao, iata
            FROM airline
            WHERE (
                        iata LIKE '%${keyword}%'
                    OR icao LIKE '%${keyword}%'
                    OR airline_cn_name LIKE '%${keyword}%'
                    OR airline_en_name LIKE '%${keyword}%'
                )
              AND is_delete = false
        `)
        }catch{
            throw new Error('查询错误')
        }

    }

    @checkNumberParams
    static async deleteById(id:number) {
        return prisma.airline.update({where:{id:id}, data:{is_delete:true}})
    }

    static async searchByAddUser(userId:number) {
        return prisma.airline.findMany({where:{add_user:userId,wait_for_review:true,is_delete:false}});
    }

    static async verifyAirline(id:number,status:'accept'|'reject') {
        if (status === 'accept') {
            return prisma.airline.update({where: {id: id}, data: {wait_for_review: false}})
        } else if (status === 'reject') {
            return prisma.airline.update({where: {id: id}, data: {is_delete: true}})
        }

    }

    static async create(airlineCnName:string,airlineEnName:string,iata:string,icao:string,addUser:number,waitForReview:boolean) {
        return prisma.airline.create({
            data:{
                airline_cn_name:airlineCnName,
                airline_en_name:airlineEnName,
                iata:iata,
                icao:icao,
                add_user:addUser,
                wait_for_review:waitForReview
            }
        })
    }

    static async getList() {
        return prisma.airline.findMany({where:{is_delete:false,wait_for_review:false}})
    }

    static async getReviewList() {
        return prisma.airline.findMany({where:{is_delete:false,wait_for_review:true}})
    }

    static async update(id:number,data:any) {
        return prisma.airline.update({where:{id:id}, data:data})
    }

    static async getById(id:number) {
        return prisma.airline.findUnique({where:{id:id}})
    }
}
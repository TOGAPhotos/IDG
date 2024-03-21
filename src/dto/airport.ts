import {PrismaClient} from '@prisma/client';
import {checkNumberParams} from "../components/decorators/checkNumberParams.js";
import {secureSqlString} from "../components/decorators/secureSqlString.js";

const prisma = new PrismaClient();


export class Airport {
    static async create(airportCn: string, airportEn: string, iata: string, icao: string, addUser: number, status: string) {
        return prisma.airport.create({
            data: {
                airport_cn: airportCn,
                airport_en: airportEn,
                iata_code: iata,
                icao_code: icao,
                add_user: addUser,
                status: status
            }
        })
    }

    @checkNumberParams
    static async getById(id: number) {
        return prisma.airport.findUnique({where: {id: id}})
    }

    @secureSqlString
    static async searchByKeyword(keyword: string) {
        if (keyword.search(/[A-Z]+/) === -1) {
            return prisma.$queryRawUnsafe(`SELECT *
                                           FROM airport
                                           WHERE (iata_code LIKE '%${keyword}%'
                                              OR icao_code LIKE '%${keyword}%')
                                              AND status = 'AVAILABLE'
                                              `);
        } else {
            return prisma.$queryRawUnsafe(`SELECT *
                                           FROM airport
                                           WHERE airport_cn LIKE '%${keyword}%' 
                                             AND status = 'AVAILABLE'`
            );
        }
    }

    static async getAvailableAirportList() {
        return prisma.airport.findMany({where: {status: 'AVAILABLE', is_delete: false}})
    }

    static async getReviewAirportList() {
        return prisma.airport.findMany({where: {status: 'WAITING', is_delete: false}})
    }

    @checkNumberParams
    static async delete(id: number) {
        return prisma.airport.update({
            where: {id: id},
            data: {is_delete: true},
        });
    }

    @checkNumberParams
    static async update(id: number, data: any) {
        return prisma.airport.update({
            where: {id: id},
            data: data,
        });
    }

    static async verifyAirportInfo(id: number, status: 'accept' | 'reject') {
        if(isNaN(id)){
            throw new Error('参数错误')
        }

        let data = {status: 'AVAILABLE'};
        if (status === 'reject') {
            data = { status: 'REJECTED' }
        }
        await prisma.airport.update({
            where: {
                id: id,
            },
            data: data
        })
    }

    static async createPreCheck(userId: number) {
        const result = await prisma.airport.findMany({
            where: {
                add_user: userId,
                status: 'WAITING',
                is_delete: false
            }
        });
        return result.length > 0;
    }


}
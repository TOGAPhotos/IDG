import {PrismaClient} from '@prisma/client';
import {checkNumberParams, checkSqlString} from "../components/params-check.js";

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


    static async getById(id: number) {
        // [id] = checkNumberParams(id)
        return prisma.airport.findUnique({where: {id: id}})
    }


    static async searchByKeyword(keyword: string) {
        [keyword] = checkSqlString(keyword)
        if (keyword.search(/^[A-Z]{3,4}$/) !== -1) {
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
                                              OR airport_en LIKE '%${keyword}%'
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


    static async delete(id: number) {
        [id] = checkNumberParams(id)
        return prisma.airport.update({
            where: {id: id},
            data: {is_delete: true},
        });
    }

    static async update(id: number, data: any) {
        [id] = checkNumberParams(id)
        return prisma.airport.update({
            where: {id: id},
            data: data,
        });
    }

    static async verifyAirportInfo(id: number, status: 'accept' | 'reject') {
        [id] = checkNumberParams(id)

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
        [userId] = checkNumberParams(userId)
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
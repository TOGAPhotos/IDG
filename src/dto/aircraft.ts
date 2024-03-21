import {PrismaClient} from '@prisma/client';
import {secureSqlString} from "../components/decorators/secureSqlString.js";

export class Aircraft {

    static prisma = new PrismaClient();

    static async create(reg: string, mns: string, ln: string, airlineId: number, remark: string) {

        return Aircraft.prisma.aircraft.create({
            data: {
                reg: reg,
                msn: mns,
                ln: ln,
                airline_id: airlineId,
                remark: remark
            }
        })
    }

    static async getById(id: number) {
        return Aircraft.prisma.aircraft.findUnique({where: {id: id}})
    }

    @secureSqlString
    static async searchByKeyword(keyword: string) {
        return Aircraft.prisma.aircraft.findMany({where:{reg: {contains: keyword}}})
    }

    static async delete(id: number) {
        return Aircraft.prisma.aircraft.update({
            where: {id: id},
            data: {is_delete: true},
        });
    }

    static async getAircraftList() {
        return Aircraft.prisma.aircraft.findMany({where: {is_delete: false}})
    }

    static async update(id:number,data:any){
        return Aircraft.prisma.aircraft.update({
            where: {id: id},
            data: data
        });
    }
}

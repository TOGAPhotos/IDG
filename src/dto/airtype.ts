import {PrismaClient} from '@prisma/client';

import {secureSqlString} from "../components/decorators/secureSqlString.js";
const prisma = new PrismaClient();
export class Airtype{
    @secureSqlString
    static async searchByKeyword(keyword:string) {
        return prisma.airtype.findMany({
            where:{sub_type:{contains:keyword}},
            orderBy:{sub_type:'asc'}}
        );
    }

    @secureSqlString
    static async create(type:string,subType:string,manufacturerCn:string,manufacturerEn:string) {
        await prisma.airtype.create({
            data: {type: type, sub_type: subType, manufacturer_cn: manufacturerCn, manufacturer_en: manufacturerEn},
        });
    }

    static async getList() {
        return prisma.airtype.findMany({orderBy:{sub_type:'asc'}});
    }
    @secureSqlString
    static async delete(subType:string) {
        await prisma.airtype.delete({where:{sub_type:subType}});
    }

    static async update(subType:string, data:any) {
        await prisma.airtype.update({where:{sub_type:subType},data:data});
    }

}
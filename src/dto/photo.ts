import {PrismaClient} from '@prisma/client';
import {checkNumberParams} from "../components/decorators/checkNumberParams.js";

const prisma = new PrismaClient();

export class Photo{
    @checkNumberParams
    static async getPhotoById(id:number) {
        return prisma.
    }
}
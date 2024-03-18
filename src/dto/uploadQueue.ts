import {PrismaClient} from "@prisma/client";
import {checkNumberParams} from "../components/decorators/checkNumberParams.js";
import Permission from "../components/auth/permissions.js";

export default class UploadQueue {
    static prisma = new PrismaClient();

    @checkNumberParams
    static async getByUserId(userId: number) {
        return this.prisma.photo_queue_info.findMany({where: {upload_user_id: userId}});
    }

    @checkNumberParams
    static async getById(photoId: number) {
        return this.prisma.photo_queue_info.findUnique({where: {queue_id: photoId}});
    }

    @checkNumberParams
    static async getTop(id: number, role: string) {
        if (Permission.isSeniorScreener(role)) {
            return this.prisma.photo_queue.findFirst({where: {photo_id: {gt: id}}})
        } else {
            return this.prisma.photo_queue.findFirst({where: {photo_id: {gt: id}, screener_1: null}})
        }

    }

    static async update(queueId: number, data: any) {
        return this.prisma.photo_queue.update({where: {queue_id: queueId}, data: {screener_1: data}});
    }

    static async recentScreenPhoto() {
        return this.prisma.full_photo_info.findMany({
            where:{
                OR:[{status: "ACCEPT"}, {status: "REJECT"}],
                is_delete:false,
            },
            orderBy:{upload_time:"desc"},
            take:200
        })
    }

    static async create(photoId: number, type: string, message: string) {
        return this.prisma.photo_queue.create({
            data: {
                photo_id: photoId,
                queue_type: type,
                message_to_screener:message
            }
        })
    }

    static async rejectQueue(userId: number) {
        return this.prisma.full_photo_info.findMany({
        where: {upload_user_id: userId, is_delete:false},
        orderBy: {upload_time: "desc"},
        take:10
        });
    }
}
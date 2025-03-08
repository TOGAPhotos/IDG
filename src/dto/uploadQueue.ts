import {PrismaClient} from "@prisma/client";
import Permission from "@/components/auth/permissions.js";

export default class UploadQueue {
    static prisma = new PrismaClient();

    static async getByUserId(userId: number) {
        return UploadQueue.prisma.full_photo_info.findMany({where:
            {
                upload_user_id: userId,
                status:'WAIT SCREEN'
            }
        });
    }

    static async getById(photoId: number) {
        return UploadQueue.prisma.full_photo_info.findUnique({where: {id: photoId}});
    }

    static async getTop(id: number, role: string) {
        if (Permission.isSeniorScreener(role)) {
            return UploadQueue.prisma.queue_photo.findFirst({
                where: {
                    id: {gt: id},
                    OR: [
                        {screener_1: null}, 
                        {screener_2: null},
                    ]
                }
            })
        } else {
            return UploadQueue.prisma.queue_photo.findFirst({
                where: {
                    id: {gt: id}, 
                    screener_1: null
                }
            })
        }

    }

    static async update(queueId: number, data: any) {
        return UploadQueue.prisma.photo.update({
            where: {id: queueId}, 
            data: data
        });
    }

    static async getQueue(type: 'normal'|'priority'|'stuck'|'all') {
        if (type === 'all') {
            return UploadQueue.prisma.photo_queue.findMany();
        }
        const query = {
            status: "WAIT SCREEN",
            queue: type.toLocaleUpperCase(),
        }
        if(type === 'stuck'){
            query.status = "STUCK"
            delete query.queue
        }
        console.log(query)
        return UploadQueue.prisma.queue_photo.findMany({where: query});
    }

    static async recentScreenPhoto() {
        return UploadQueue.prisma.full_photo_info.findMany({
            where:{
                OR:[{status: "ACCEPT"}, {status: "REJECT"}],
                // is_delete:false,
            },
            orderBy:{upload_time:"desc"},
            take:200
        })
    }

    static async rejectQueue(userId: number) {
        return this.prisma.full_photo_info.findMany({
            where: {
                upload_user_id: userId,
                status:'REJECT'
            },
            orderBy: {upload_time: "asc"},
            take:10
        });
    }
}
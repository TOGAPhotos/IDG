import { PrismaClient } from "@prisma/client";

export class DirectMessage {
    private static readonly prisma = new PrismaClient();

    static async getNewest() {
        return DirectMessage.prisma.direct_message.findFirst({
            where: { status: 'WAITING' },
            orderBy: { id: 'desc', }
        });
    }

    static async create(
        senderId: number,
        receiverId: number,
        contactInfo: string,
        content: string
    ) {
        return DirectMessage.prisma.direct_message.create({
            data: {
                sender_user_id: senderId,
                receiver_user_id: receiverId,
                content: content,
                contact_info: contactInfo
            }
        });
    }

    static async getById(id: number) {
        return DirectMessage.prisma.direct_message.findUnique({ where: { id: id } });
    }

    static async createPrecheck(id:number){
        return DirectMessage.prisma.direct_message.findMany({
            where: {
                id: id,
                create_time:{
                    gt: new Date(Date.now() - 1000  * 3600 * 24)
                }
            }
        })
    }

    static async getBySender(senderId: number, status: "WAITING" | "ERROR" | "SUCCESS" = "WAITING") {
        return DirectMessage.prisma.direct_message.findMany({
            where: {
                sender_user_id: senderId,
                status: status
            }
        });
    }

    static async getByReceiver(receiverId: number, status: "WAITING" | "ERROR" | "SUCCESS" = "WAITING") {
        return DirectMessage.prisma.direct_message.findMany({
            where: {
                receiver_user_id: receiverId,
                status: status
            }
        });
    }

    static async updateStatus(id: number, status: "WAITING" | "ERROR" | "SUCCESS") {
        return DirectMessage.prisma.direct_message.update({
            where: { id: id },
            data: { status: status }
        });
    }

}
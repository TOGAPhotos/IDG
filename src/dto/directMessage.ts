import { safeSQL } from "../components/decorators/safeSQL.js";
import { prisma } from "../lib/prisma.js";

type DirectMessageStatus = "WAITING" | "ERROR" | "SUCCESS";

export class DirectMessage {

  static async getNewest() {
    return prisma.direct_message.findFirst({
      where: { status: "WAITING" },
      orderBy: { id: "desc" },
    });
  }

  @safeSQL
  static async create(
    senderId: number,
    receiverId: number,
    phtooId: number,
    contactInfo: string,
    content: string,
  ) {
    return prisma.direct_message.create({
      data: {
        sender_user_id: senderId,
        receiver_user_id: receiverId,
        photo_id: phtooId,
        content: content,
        contact_info: contactInfo,
      },
    });
  }

  static async getById(id: number) {
    return prisma.direct_message.findUnique({
      where: { id: id },
    });
  }

  static async createPrecheck(id: number) {
    return prisma.direct_message.findMany({
      where: {
        sender_user_id: id,
        create_time: {
          gte: new Date(Date.now() - 1000 * 3600 * 24),
        },
      },
    });
  }

  static async getBySender(senderId: number, status: DirectMessageStatus) {
    return prisma.direct_message.findMany({
      where: {
        sender_user_id: senderId,
        status: status,
      },
    });
  }

  static async getByReceiver(receiverId: number, status: DirectMessageStatus) {
    return prisma.direct_message.findMany({
      where: {
        receiver_user_id: receiverId,
        status: status,
      },
    });
  }

  static async updateStatus(
    id: number,
    status: "WAITING" | "ERROR" | "SUCCESS",
  ) {
    return prisma.direct_message.update({
      where: { id: id },
      data: { status: status },
    });
  }
}

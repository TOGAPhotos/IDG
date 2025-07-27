import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default class Notam {
  static async getNewest() {
    return prisma.notam.findFirst({ orderBy: { id: "desc" } });
  }

  static async create(title: string, content: string, userId: number) {
    return prisma.notam.create({
      data: {
        title: title,
        content: content,
        create_user: userId,
      },
    });
  }

  static async getById(id: number) {
    return prisma.notam.findUnique({ where: { id: id } });
  }
}

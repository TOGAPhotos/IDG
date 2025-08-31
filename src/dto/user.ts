import { PrismaClient } from "@prisma/client";
import { checkNumberParams } from "../components/decorators/checkNumberParams.js";
import { safeSQL } from "../components/decorators/safeSQL.js";

const prisma = new PrismaClient();

export default class User {
  @safeSQL
  static async create(userEmail: string, username: string, password: string) {
    return prisma.user.create({
      data: {
        user_email: userEmail,
        username: username,
        password: password,
      },
    });
  }

  static async updateById(id: number, data: any) {
    return prisma.user.update({ where: { id: id }, data: data });
  }

  @checkNumberParams
  static async updatePassingRate(userId: number) {
    const list = await prisma.full_photo_info.findMany({
      select: {
        status: true,
      },
      where: {
        upload_user_id: userId,
        OR: [{ status: "ACCEPT" }, { status: "REJECT" }],
      },
      orderBy: {
        id: "desc",
      },
      take: 50,
    });
    let passingRate = 0;
    list.map((photo) => {
      if (photo.status === "ACCEPT") {
        passingRate++;
      }
    });
    passingRate = Math.round((passingRate / list.length) * 100);
    await prisma.user.update({
      where: { id: userId },
      data: { passing_rate: passingRate },
    });
  }


  static async getById(id: number) {
    const res = await prisma.user.findUnique({ where: { id: id } });
    if (res === null) {
      throw new Error("用户不存在");
    }
    return res;
  }

  @safeSQL
  static async getByEmail(email: string) {
    return prisma.user.findMany({
      where: { user_email: email, is_deleted: false },
    });
  }

  @safeSQL
  static getByUsername(username: string) {
    return prisma.user.findMany({
      where: { username:  username },
    });
  }

  static getList(offset = 0, limit = 200) {
    return prisma.user.findMany({
      where: {
        is_deleted: false,
        id: { gt: offset },
      },
      take: limit,
    });
  }

  @safeSQL
  static async search(keyword: string, offset = 0, limit = 200) {
    return prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: keyword } },
          { user_email: { contains: keyword } },
        ],
        id: { gt: offset },
        is_deleted: false,
      },
      take: limit,
    });
  }

  @checkNumberParams
  static async delete(id: number) {
    return prisma.user.update({
      where: { id: id },
      data: { is_deleted: true },
    });
  }
}

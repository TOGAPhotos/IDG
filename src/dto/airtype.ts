import { PrismaClient } from "@prisma/client";

import { safeSQL } from "../components/decorators/safeSQL.js";
const prisma = new PrismaClient();
export class Airtype {
  @safeSQL
  static async searchByKeyword(keyword: string) {
    return prisma.airtype.findMany({
      where: {
        status: "AVAILABLE",
        sub_type: { contains: keyword }
      },
      orderBy: { sub_type: "asc" },
    });
  }

  static async getById(id: number) {
    return prisma.airtype.findUnique({ where: { id: id } });
  }

  static async createPreCheck(userId: number) {
    const res = await prisma.airtype.findMany({
      where: {
        create_user: userId,
        status: "WAITING",
      },
    });
    return res.length > 0;
  }

  static async create(
    manufacturerCn: string,
    manufacturerEn: string,
    type: string,
    subType: string,
    icao: string,
    status: string,
    userId: number,
  ) {
    await prisma.airtype.create({
      data: {
        manufacturer_cn: manufacturerCn,
        manufacturer_en: manufacturerEn,
        type: type,
        sub_type: subType,
        icao_code: icao,
        status: status as "AVAILABLE" | "WAITING",
        create_user: userId,
      },
    });
  }

  static async getReviewList() {
    return prisma.airtype.findMany({
      where: { status: "WAITING" },
      orderBy: { sub_type: "asc" },
    });
  }

  static async getList() {
    return prisma.airtype.findMany({ orderBy: { sub_type: "asc" } });
  }

  static async delete(id: number) {
    await prisma.airtype.delete({ where: { id: id } });
  }

  static async update(id: number, data: any) {
    return prisma.airtype.update({ where: { id: id }, data: data });
  }
}

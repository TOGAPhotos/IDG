import { PrismaClient } from "@prisma/client";
import { safeSQL } from "../components/decorators/safeSQL.js";
const prisma = new PrismaClient();

export class Airline {
  @safeSQL
  static async searchByKeyword(keyword: string) {
    try {
      return await prisma.airline.findMany({
        where: {
          OR: [
            { airline_cn: { contains: keyword } },
            { airline_en: { contains: keyword } },
            { iata_code: { contains: keyword } },
            { icao_code: { contains: keyword } },
          ],
          status: "AVAILABLE",
          is_delete: false,
        },
      });
    } catch {
      throw new Error("查询错误");
    }
  }

  static async deleteById(id: number) {
    return prisma.airline.update({
      where: { id: id },
      data: { is_delete: true },
    });
  }

  static async preCheck(userId: number) {
    return prisma.airline.findMany({
      where: {
        create_user: userId,
        status: "WAITING",
        is_delete: false,
      },
    });
  }

  @safeSQL
  static async create(
    airlineCnName: string,
    airlineEnName: string,
    iata: string,
    icao: string,
    addUser: number,
    status: string,
  ) {
    return prisma.airline.create({
      data: {
        airline_cn: airlineCnName,
        airline_en: airlineEnName,
        iata_code: iata,
        icao_code: icao,
        create_user: addUser,
        status: status,
      },
    });
  }

  static async getList() {
    return prisma.airline.findMany({
      where: {
        is_delete: false,
        status: "AVAILABLE",
      },
    });
  }

  static async getReviewList() {
    return prisma.airline.findMany({
      where: {
        is_delete: false,
        status: "WAITING",
      },
    });
  }

  @safeSQL
  static async update(id: number, data: any) {
    return prisma.airline.update({
      where: { id: id },
      data: data,
    });
  }

  static async getById(id: number) {
    return prisma.airline.findUnique({ where: { id: id } });
  }
}

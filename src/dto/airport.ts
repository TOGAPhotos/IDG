import { PrismaClient } from "@prisma/client";
import { safeSQL } from "@/components/decorators/safeSQL.js";

const prisma = new PrismaClient();

export class Airport {
  static async create(
    airportCn: string,
    airportEn: string,
    iata: string,
    icao: string,
    addUser: number,
    status: string,
  ) {
    return prisma.airport.create({
      data: {
        airport_cn: airportCn,
        airport_en: airportEn,
        iata_code: iata,
        icao_code: icao,
        create_user: addUser,
        status: status,
      },
    });
  }

  static async getById(id: number) {
    return prisma.airport.findUnique({ where: { id: id } });
  }

  @safeSQL
  static async searchByKeyword(keyword: string) {
    return prisma.airport.findMany({
      where: {
        OR: [
          { iata_code: { contains: keyword } },
          { icao_code: { contains: keyword } },
          { airport_cn: { contains: keyword } },
          { airport_en: { contains: keyword } },
        ],
        status: "AVAILABLE",
        is_delete: false,
      },
    });
  }

  static async getAvailableAirportList() {
    return prisma.airport.findMany({
      where: { status: "AVAILABLE", is_delete: false },
    });
  }

  static async getReviewAirportList() {
    return prisma.airport.findMany({
      where: { status: "WAITING", is_delete: false },
    });
  }

  static async delete(id: number) {
    return prisma.airport.update({
      where: { id: id },
      data: { is_delete: true },
    });
  }

  static async update(id: number, data: any) {
    return await prisma.airport.update({
      where: { id: id },
      data: data,
    });
  }

  static async createPreCheck(userId: number) {
    const result = await prisma.airport.findMany({
      where: {
        create_user: userId,
        status: "WAITING",
        is_delete: false,
      },
    });
    return result.length > 0;
  }
}

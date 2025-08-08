import { PrismaClient } from "@prisma/client";
import { checkNumberParams } from "../components/decorators/checkNumberParams.js";
import { safeSQL } from "../components/decorators/safeSQL.js";

interface PhotoInfo {
  userId: number;
  uploadTime: Date;
  queue: string;
  reg: string;
  msn: string;
  airline: number;
  ac_type: string;
  airport: number;
  picType: string;
  photoTime: Date;
  remark: string;
  exif: string;
  watermark: string;
}

export default class Photo {
  private static prisma = new PrismaClient();

  public static searchSelectConfig = {
    id: true,
    username: true,
    ac_type: true,
    ac_reg: true,
    airline_cn: true,
    airline_en: true,
    airline_iata_code:true,
    airline_icao_code:true,
    airport_cn: true,
    airport_en: true,
  }

  @checkNumberParams
  static async getById(id: number) {
    return this.prisma.full_photo_info.findUnique({ where: { id: id } });
  }

  @checkNumberParams
  static async getAcceptById(id: number) {
    return this.prisma.accept_photo.findUnique({ where: { id: id } });
  }

  @checkNumberParams
  static async getByUserId(userId: number) {
    return this.prisma.accept_photo.findMany({
      where: { upload_user_id: userId },
    });
  }

  @checkNumberParams
  static async deleteById(id: number) {
    try {
      await this.prisma.photo.update({
        where: { id: id },
        data: { is_delete: true },
      });
    } catch (e) {
      await this.prisma.photo.update({
        where: { id: id },
        data: { is_delete: false },
      });
      throw new Error("删除失败");
    }
    return;
  }

  static async getAcceptPhotoList(lastId: number, num: number) {
    if (lastId === -1) {
      return this.prisma.accept_photo.findMany({
        take: num,
        orderBy: { id: "desc" },
      });
    } else {
      return this.prisma.accept_photo.findMany({
        where: {
          id: { lt: lastId },
        },
        take: num,
        orderBy: { id: "desc" },
      });
    }
  }

  static async blurrySearch(keyword: string, lastId: number, num: number) {
    lastId = Number(lastId);
    if (lastId === -1) {
      return this.prisma.accept_photo.findMany({
      select: Photo.searchSelectConfig,
        where: {
          OR: [
            { ac_reg: { contains: keyword } },
            { ac_msn: { contains: keyword } },
            { ac_type: { contains: keyword } },
            { airport_cn: { contains: keyword } },
            { airport_en: { contains: keyword } },
            { airport_iata_code: { contains: keyword } },
            { airport_icao_code: { contains: keyword } },
            { username: { contains: keyword } },
          ],
        },
        orderBy: { id: "desc" },
        take: num,
      });
    } else {
      return this.prisma.accept_photo.findMany({
        select: Photo.searchSelectConfig,
        where: {
          OR: [
            { ac_reg: { contains: keyword } },
            { ac_msn: { contains: keyword } },
            { ac_type: { contains: keyword } },
            { airport_cn: { contains: keyword } },
            { airport_en: { contains: keyword } },
            { airport_iata_code: { contains: keyword } },
            { airport_icao_code: { contains: keyword } },
            { username: { contains: keyword } },
          ],
          id: { lt: lastId },
        },
        orderBy: { id: "desc" },
        take: num,
      });
    }
  }

  // @secureSqlString
  static async searchByRegKeyword(
    keyword: string,
    lastId: number,
    num: number,
  ) {
    lastId = Number(lastId);
    if (lastId === -1) {
      return this.prisma.accept_photo.findMany({
        where: {
          select: Photo.searchSelectConfig,
          ac_reg: { contains: keyword },
        },
        orderBy: { id: "desc" },
        take: num,
      });
    } else {
      return this.prisma.accept_photo.findMany({
        select: Photo.searchSelectConfig,
        where: {
          ac_reg: { contains: keyword },
          id: { lt: lastId },
        },
        take: num,
        orderBy: { id: "desc" },
      });
    }
  }

  // @secureSqlString
  static async searchByAirlineKeyword(
    keyword: string,
    lastId: number,
    num: number,
  ) {
    lastId = Number(lastId);
    if (lastId === -1) {
      return this.prisma.accept_photo.findMany({
        select: Photo.searchSelectConfig,
        where: {
          OR: [
            { airline_cn: { contains: keyword } },
            { airline_en: { contains: keyword } },
          ],
        },
        orderBy: { id: "desc" },
        take: num,
      });
    } else {
      return this.prisma.accept_photo.findMany({
        select: Photo.searchSelectConfig,
        where: {
          OR: [
            { airline_cn: { contains: keyword } },
            { airline_en: { contains: keyword } },
          ],
          id: { lt: lastId },
        },
        orderBy: { id: "desc" },
        take: num,
      });
    }
  }

  static async searchByAirtypeKeyword(
    keyword: string,
    lastId: number,
    num: number,
  ) {
    lastId = Number(lastId);
    if (lastId === -1) {
      return this.prisma.accept_photo.findMany({
        select: Photo.searchSelectConfig,
        where: {
          ac_type: { contains: keyword },
        },
        take: num,
        orderBy: { id: "desc" },
      });
    } else {
      return this.prisma.accept_photo.findMany({
        select: Photo.searchSelectConfig,
        where: {
          ac_type: { contains: keyword },
          id: { lt: lastId },
        },
        take: num,
        orderBy: { id: "desc" },
      });
    }
  }

  static async searchByAirportKeyword(
    keyword: string,
    lastId: number,
    num: number,
  ) {
    lastId = Number(lastId);
    if (lastId === -1) {
      return this.prisma.accept_photo.findMany({
        select: Photo.searchSelectConfig,
        where: {
          OR: [
            { airport_cn: { contains: keyword } },
            { airport_en: { contains: keyword } },
            { airport_iata_code: { contains: keyword } },
            { airport_icao_code: { contains: keyword } },
          ],
        },
        orderBy: { id: "desc" },
        take: num,
      });
    } else {
      return this.prisma.accept_photo.findMany({
        select: Photo.searchSelectConfig,
        where: {
          OR: [
            { airport_cn: { contains: keyword } },
            { airport_en: { contains: keyword } },
            { airport_iata_code: { contains: keyword } },
            { airport_icao_code: { contains: keyword } },
          ],
          id: { lt: lastId },
        },
        orderBy: { id: "desc" },
        take: num,
      });
    }
  }

  // @secureSqlString
  static async searchByUserKeyword(
    keyword: string,
    lastId: number,
    num: number,
  ) {
    lastId = Number(lastId);
    if (lastId === -1) {
      return this.prisma.accept_photo.findMany({
        select: Photo.searchSelectConfig,
        where: {
          username: { contains: keyword },
        },
        orderBy: { id: "desc" },
        take: num,
      });
    } else {
      return this.prisma.accept_photo.findMany({
        select: Photo.searchSelectConfig,
        where: {
          username: { contains: keyword },
          id: { lt: lastId },
        },
        orderBy: { id: "desc" },
        take: num,
      });
    }
  }

  static async create(data: PhotoInfo) {
    return this.prisma.photo.create({
      data: {
        upload_user_id: data.userId,
        upload_time: data.uploadTime,
        ac_reg: data.reg,
        ac_msn: data.msn,
        airline_id: data.airline,
        ac_type: data.ac_type,
        airport_id: data.airport,
        pic_type: data.picType,
        photo_time: data.photoTime,
        user_remark: data.remark,
        queue: data.queue,
        exif: data.exif,
        watermark: data.watermark,
        // allow_social_media:data.allowSocialMedia
      },
    });
  }

  static async update(id: number, data: any) {
    return this.prisma.photo.update({ where: { id: id }, data: data });
  }
}

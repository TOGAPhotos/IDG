import { Prisma, PrismaClient } from "@prisma/client";
import { checkNumberParams } from "../components/decorators/checkNumberParams.js";
import { safeSQL } from "../components/decorators/safeSQL.js";

export interface AdvancedSearchQuery {
  and?: {
    reg?: string[];
    airline?: string[];
    airport?: string[];
    airtype?: string[];
    user?: string[];
  };
  not?: {
    reg?: string[];
    airline?: string[];
    airport?: string[];
    airtype?: string[];
    user?: string[];
  };
  lastId?: number;
  num?: number;
}

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

  public static readonly searchSelectConfig = {
    id: true,
    username: true,
    ac_type: true,
    ac_reg: true,
    airline_cn: true,
    airline_en: true,
    airline_iata_code: true,
    airline_icao_code: true,
    airport_cn: true,
    airport_en: true,
    pic_type: true,
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
    const queryArgs = {
      take: num,
      orderBy: { id: "desc" },
    } satisfies Prisma.accept_photoFindManyArgs
    if (lastId !== -1) {
      queryArgs["where"] = { id: { lt: lastId } };
    }
    return this.prisma.accept_photo.findMany(queryArgs);
  }

  static async getScreenerChoicePhotoList(lastId: number, num: number) {
    const queryArgs = {
      where: {
        pic_type: { contains: "ScreenerChoice" },
      },
      take: num,
      orderBy: { upload_time: "desc" },
    } satisfies Prisma.accept_photoFindManyArgs
    if (lastId !== -1) {
      queryArgs.where["id"] = { lt: lastId };
    }
    return this.prisma.accept_photo.findMany(queryArgs);
  }

  @safeSQL
  static async blurrySearch(keyword: string, lastId: number, num: number) {
    const queryArgs = {
      select: Photo.searchSelectConfig,
      where: {
        OR: [
          { ac_reg: { contains: keyword } },
          { ac_msn: { contains: keyword } },
          { ac_type: { contains: keyword } },
          { airport_cn: { contains: keyword } },
          { airport_en: { contains: keyword } },
          { airline_en: { contains: keyword } },
          { airline_cn: { contains: keyword } },
          { airport_iata_code: { contains: keyword } },
          { airport_icao_code: { contains: keyword } },
          { username: { contains: keyword } },
        ],
      },
      orderBy: { id: "desc" },
      take: num,
    } satisfies Prisma.accept_photoFindManyArgs;

    if (lastId !== -1) {
      queryArgs.where["id"] = { lt: lastId };
    }
    return this.prisma.accept_photo.findMany(queryArgs);
  }

  @safeSQL
  static async searchByRegKeyword(
    keyword: string,
    lastId: number,
    num: number,
  ) {
    if (lastId === -1) {
      return this.prisma.accept_photo.findMany({
        select: Photo.searchSelectConfig,
        where: {
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

  @safeSQL
  static async searchByAirlineKeyword(
    keyword: string,
    lastId: number,
    num: number,
  ) {
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

  @safeSQL
  static async searchByAirtypeKeyword(
    keyword: string,
    lastId: number,
    num: number,
  ) {
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
        upload_time: Date.now(),
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
      },
    });
  }

  static async update(id: number, data: any) {
    return this.prisma.photo.update({ where: { id: id }, data: data });
  }

  static async advancedSearch(searchQuery: AdvancedSearchQuery,lastId: number,num: number) {
    const { and, not } = searchQuery;
    const andConditions: Prisma.accept_photoWhereInput[] = [];
    const notConditions: Prisma.accept_photoWhereInput[] = [];

    // 构建 AND 条件（每个字段内部是 OR 关系）
    if (and) {
      if (and.reg?.length) {
        andConditions.push({
          OR: and.reg.map((r) => ({ ac_reg: { contains: r } })),
        });
      }
      if (and.airline?.length) {
        andConditions.push({
          OR: and.airline.flatMap((a) => [
            { airline_cn: { contains: a } },
            { airline_en: { contains: a } },
          ]),
        });
      }
      if (and.airport?.length) {
        andConditions.push({
          OR: and.airport.flatMap((a) => [
            { airport_cn: { contains: a } },
            { airport_en: { contains: a } },
            { airport_iata_code: { contains: a } },
            { airport_icao_code: { contains: a } },
          ]),
        });
      }
      if (and.airtype?.length) {
        andConditions.push({
          OR: and.airtype.map((t) => ({ ac_type: { contains: t } })),
        });
      }
      if (and.user?.length) {
        andConditions.push({
          OR: and.user.map((u) => ({ username: { contains: u } })),
        });
      }
    }

    // 构建 NOT 条件
    if (not) {
      if (not.reg?.length) {
        notConditions.push(
          ...not.reg.map((r) => ({ ac_reg: { contains: r } })),
        );
      }
      if (not.airline?.length) {
        notConditions.push(
          ...not.airline.flatMap((a) => [
            { airline_cn: { contains: a } },
            { airline_en: { contains: a } },
          ]),
        );
      }
      if (not.airport?.length) {
        notConditions.push(
          ...not.airport.flatMap((a) => [
            { airport_cn: { contains: a } },
            { airport_en: { contains: a } },
            { airport_iata_code: { contains: a } },
            { airport_icao_code: { contains: a } },
          ]),
        );
      }
      if (not.airtype?.length) {
        notConditions.push(
          ...not.airtype.map((t) => ({ ac_type: { contains: t } })),
        );
      }
      if (not.user?.length) {
        notConditions.push(
          ...not.user.map((u) => ({ username: { contains: u } })),
        );
      }
    }

    // 组合最终查询条件
    const whereClause: Prisma.accept_photoWhereInput = {};
    if (andConditions.length > 0) {
      whereClause.AND = andConditions;
    }
    if (notConditions.length > 0) {
      whereClause.NOT = notConditions;
    }
    if (lastId !== -1) {
      whereClause.id = { lt: lastId };
    }

    return this.prisma.accept_photo.findMany({
      select: Photo.searchSelectConfig,
      where: whereClause,
      orderBy: { id: "desc" },
      take: num,
    });
  }
}

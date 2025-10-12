import { Prisma, PrismaClient } from "@prisma/client";
import type {
  VoteCreateArgs,
  VoteRecordCreateArgs,
  VoteQueryArgs,
  VoteEventStatus,
  VoteType,
} from "../dto/vote.d.js";

export default class Vote {
  private static prisma = new PrismaClient();

  static async create(data: Prisma.vote_listCreateInput) {
    return Vote.prisma.vote_list.create({
      data: data,
    });
  }

  static async delete(id: number) {
    return Vote.prisma.vote_list.update({
      where: { id: id },
      data: { is_delete: true },
    });
  }

  static async getById(id: number) {
    return Vote.prisma.vote_list.findUnique({ where: { id: id } });
  }

  static async getList(
    queryArg: Prisma.vote_listWhereInput = {},
    lastId: number = -1,
    limit: number = 50,
  ) {
    queryArg.is_delete = false;
    return Vote.prisma.vote_list.findMany({
      where: queryArg,
      take: limit,
    });
  }

  public static async SCVotePreCheck(photoId: number) {
    return Vote.prisma.vote_list.findFirst({
      where: {
        photo_id: photoId,
        type: "SC",
        tally: { gt: 0 },
        is_delete: false,
      },
    });
  }

  static async getSCVoteList(
    queryArg: VoteQueryArgs,
    lastId: number = -1,
    limit: number = 50,
  ) {
    queryArg.type = "SC";
    return Vote.getList(queryArg, lastId, limit);
  }

  static async getLatestSCVote(userId: number) {
    const result = await Vote.prisma.$queryRawUnsafe(`
    SELECT *
    FROM vote_list
    WHERE status = 'IN PROGRESS'
    AND id NOT IN (
        SELECT DISTINCT vote_event
        FROM vote_record
        WHERE vote_record.user = ${userId}
        )
    AND type = 'SC'
    AND is_delete = false
    ORDER BY id DESC
    LIMIT 1
    `) as unknown as Prisma.vote_listGetPayload<null>[];
    return result.length > 0 ? result[0] : null;
  }
  public static async updateTally(voteId: number, tally: number) {
    return Vote.prisma.vote_list.update({
      where: { id: voteId },
      data: { tally: { increment: tally } },
    });
  }

  public static async createRecord(data: Omit<Prisma.vote_recordCreateInput, "create_time">) {
    return Vote.prisma.vote_record.create({
      data: {
        ...data,
        create_time: Date.now(),
      },
    });
  }

  public static async getRecordByEvent(
    voteEventId: number,
    lastId: number = -1,
    limit: number = 50,
  ) {
    return Vote.prisma.vote_record.findMany({
      where: {
        vote_event: voteEventId,
        id: {
          gt: lastId,
        },
      },
      orderBy: {
        id: "desc",
      },
      take: limit,
    });
  }

  public static async getRecordByUserAndEvent(
    userId: number,
    voteEventId: number,
  ) {
    return Vote.prisma.vote_record.findMany({
      where: {
        user: userId,
        vote_event: voteEventId,
      },
    });
  }
  public static async deleteRecord(id: number) {
    return Vote.prisma.vote_record.update({
      where: { id: id },
      data: { is_delete: true },
    });
  }
}

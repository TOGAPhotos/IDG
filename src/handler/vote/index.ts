import { Request, Response } from "express";
import Vote from "../../dto/vote.js";
import type { VoteEventStatus } from "../../dto/vote.d.js";
import { HTTP_STATUS } from "../../types/http_code.js";
import { ReqQueryCheck } from "../../components/decorators/ReqCheck.js";
import Photo from "../../dto/photo.js";

export default class VoteHandler {
  public static async getVote(req: Request, res: Response) {
    const vote = await Vote.getById(Number(req.params.id));
    if (vote === null) {
      return res.fail(HTTP_STATUS.NOT_FOUND, "投票不存在");
    }
    res.success("查询成功", vote);
  }

  public static async getSCVoteList(req: Request, res: Response) {
    const lastId = Number(req.query["lastId"]) || -1;
    const pId = Number(req.query["pId"]) || undefined;
    const status: VoteEventStatus =
      <VoteEventStatus | null>req.query["status"] || "IN_PROGRESS";
    const list = await Vote.getSCVoteList(
      {
        is_delete: false,
        status: status,
        photo_id: pId,
      },
      lastId,
      50,
    );
    res.success("查询成功", list);
  }

  public static async getSCVoteWaitList(req: Request, res: Response) {}

  public static async getSCVote(req: Request, res: Response) {
    const voteId = Number(req.params.id);
    const loadDetail = req.query["detail"] === "true";
    if (isNaN(voteId)) {
      return res.fail(HTTP_STATUS.BAD_REQUEST, "无效的投票ID");
    }
    const vote = await Vote.getById(voteId);
    if (vote === null || vote.is_delete) {
      return res.fail(HTTP_STATUS.NOT_FOUND, "投票不存在");
    }
    if (vote.type !== "SC") {
      return res.fail(HTTP_STATUS.BAD_REQUEST, "该投票不是SC投票");
    }
    // if (loadDetail) {
    // }

    res.success("查询成功", vote);
  }

  @ReqQueryCheck("pId")
  public static async createSCVote(req: Request, res: Response) {
    const photoId = Number(req.query?.pId);
    if (isNaN(photoId)) {
      return res.fail(HTTP_STATUS.BAD_REQUEST, "无效的图片ID");
    }

    const [photo, preCheck] = await Promise.all([
      Photo.getById(photoId),
      Vote.SCVotePreCheck(photoId),
    ]);

    if (preCheck !== null) {
      return res.fail(HTTP_STATUS.CONFLICT, "该图片已经有正在进行的SC投票");
    }
    if (photo === null) {
      return res.fail(HTTP_STATUS.NOT_FOUND, "图片不存在");
    }

    let newVoteId: number | null = null;
    try {
      const newVote = await Vote.create({
        title: null,
        description: null,
        photo_id: photoId,
        user: req.token.id,
        type: "SC",
        status: "IN_PROGRESS",
        tally: 1,
        start: Date.now(),
        end: Date.now() + 24 * 60 * 60 * 1000, // 默认24小时后结束
      });
      newVoteId = newVote.id;
      const voteRecord = await Vote.createRecord({
        user: req.token.id,
        vote_event: newVote.id,
        tally: 1,
      });
      res.success("投票创建成功", newVote);
    } catch (err) {
      if (newVoteId !== null) {
        await Vote.delete(newVoteId);
      }
      res.fail(
        HTTP_STATUS.SERVER_ERROR,
        "创建投票失败: " + (<Error>err).message,
      );
    }
  }

  @ReqQueryCheck("t")
  public static async SCVote(req: Request, res: Response) {
    const voteId = Number(req.params.id);
    const tally = Number(req.query.t); // t = tally, 票数，正为赞同，负为反对，SC投票默认一票
    if (isNaN(voteId)) {
      return res.fail(HTTP_STATUS.BAD_REQUEST, "无效的投票ID");
    }
    if (isNaN(tally)) {
      return res.fail(HTTP_STATUS.BAD_REQUEST, "无效的投票数");
    }
    const vote = await Vote.getById(voteId);
    if (vote === null) {
      return res.fail(HTTP_STATUS.NOT_FOUND, "投票不存在");
    }
    if (vote.type !== "SC") {
      return res.fail(HTTP_STATUS.BAD_REQUEST, "该投票不是SC投票");
    }

    // const existingVote = await Vote.getRecordByUserAndEvent(
    //   req.token.id,
    //   voteId,
    // );
    // if (existingVote.length > 0) {
    //   return res.fail(HTTP_STATUS.BAD_REQUEST, "您已经投过票了");
    // }

    let recordId = null;
    let update = null;
    try {
      [recordId, update] = await Promise.all([
        Vote.createRecord({
          user: req.token.id,
          vote_event: voteId,
          tally: tally,
        }),
        Vote.updateTally(voteId, tally),
      ]);
      res.success("投票成功");
    } catch (e) {
      if (recordId !== null) {
        await Vote.deleteRecord(recordId);
      }
      if (update !== null) {
        await Vote.updateTally(voteId, -tally);
      }
      res.fail(HTTP_STATUS.SERVER_ERROR, "投票失败: " + (<Error>e).message);
    }
  }

  public static async deleteVote(req: Request, res: Response) {
    const voteId = Number(req.params.id);
    if (isNaN(voteId)) {
      return res.fail(HTTP_STATUS.BAD_REQUEST, "无效的投票ID");
    }
    const vote = await Vote.getById(voteId);
    if (vote === null) {
      return res.fail(HTTP_STATUS.NOT_FOUND, "投票不存在");
    }
    await Vote.delete(voteId);
    res.success("删除成功");
  }
}

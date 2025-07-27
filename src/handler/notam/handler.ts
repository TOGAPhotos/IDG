import { Request, Response } from "express";
import NotamCache from "./cache.js";
import Notam from "../../dto/notam.js";

const notamCache = new NotamCache();

export default class NotamHandler {
  static async get(req: Request, res: Response) {
    let notam = notamCache.getCache();
    if (!notam) {
      await notamCache.renewCache();
      notam = notamCache.getCache();
    }
    return res.success("获取成功", {
      id: notam.id,
      title: notam.title,
      content: notam.content,
    });
  }

  static async create(req: Request, res: Response) {
    const { title, content } = req.body;
    const createrId = req.token.id;

    await Notam.create(title, content, createrId);
    await notamCache.renewCache();

    return res.success("创建成功");
  }
}

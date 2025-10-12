import { Screener } from "../../dto/screener.js";
import { Request, Response } from "express";

export default class ScreenerHandler{
  public static async getScreeningStatistic(req:Request, res:Response){
      return res.success("success", await Screener.getScreeningStatistics(req.token.id));
  }
}
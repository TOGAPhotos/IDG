import { Request, Response } from "express";
import { ReqQueryCheck } from "../../components/decorators/ReqCheck.js";
import { TENCENTCLOUD_CDN_PKEY } from "../../config.js";
import crypto from "crypto";

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

export default class CDNHandler {

  private static md5(input: string) {
    return crypto.hash("md5",input,"hex");
  }
  private static randomString(length: number=8){
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(getRandomInt(chars.length));
    }
    return result;
  }

  public static async sign(req: Request, res: Response) {
    const url = <string>req.query['url'];
    const path = "/" + url.split("/").slice(3).join("/");
    const rand = CDNHandler.randomString();
    const timeStamp = Math.floor(Date.now() / 1000);
    const uid = 0;
    const md5Hash = CDNHandler.md5(`${path}-${timeStamp}-${rand}-${uid}-${TENCENTCLOUD_CDN_PKEY}`);
    return res.redirect(`${url}?sign=${timeStamp}-${rand}-${uid}-${md5Hash}`)
  }
}
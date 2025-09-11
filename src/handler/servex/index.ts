import { Request, Response } from "express";
import { ReqQueryCheck } from "../../components/decorators/ReqCheck.js";
import { TENCENTCLOUD_CDN_PKEY } from "../../config.js";
import crypto from "crypto";
import Photo from "../../dto/photo.js";
import User from "../../dto/user.js";
import Permission from "../../components/auth/permissions.js";
import { getPhotoCDNUrl } from "../../service/cdn/index.js";

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

export default class ServexHandler {

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

  @ReqQueryCheck("url")
  public static async sign(req: Request, res: Response) {
    const url = <string>req.query['url'];
    const path = "/" + url.split("/").slice(3).join("/");
    const rand = ServexHandler.randomString();
    const timeStamp = Math.floor(Date.now() / 1000);
    const uid = 0;
    const md5Hash = ServexHandler.md5(`${path}-${timeStamp}-${rand}-${uid}-${TENCENTCLOUD_CDN_PKEY}`);
    return res.redirect(`${url}?sign=${timeStamp}-${rand}-${uid}-${md5Hash}`)
  }

  public static async accessRawPhoto(req: Request, res: Response) {
    const photoId = Number(req.params['id']);
    const photo = await Photo.getById(photoId);
    if( !photo && photo.upload_user_id !== req.token.id ){
      const user = await User.getById(req.token.id);
      if (!user || !Permission.isStaff(user.role)){
        return res.fail(403,"没有权限访问该照片");
      }
    }
    req.url += `?sign=${getPhotoCDNUrl(photoId,true)}`;
    return ServexHandler.sign(req,res);
  }
}
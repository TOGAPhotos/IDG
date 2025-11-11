import { Request, Response } from "express";
import { ReqQueryCheck } from "../../components/decorators/ReqCheck.js";
import { TENCENTCLOUD_CDN_PKEY } from "../../config.js";
import crypto from "crypto";
import Photo from "../../dto/photo.js";
import User from "../../dto/user.js";
import Permission from "../../components/auth/permissions.js";
import { getPhotoCDNUrl } from "../../service/cdn/index.js";
import SearchCache from "../../service/redis/searchCache.js";
import { REDIS_DB } from "../../service/redis/distribute.js";
import Log from "../../components/loger.js";


export default class ServexHandler {

  private static preSignMap = new SearchCache(REDIS_DB.CDN_SIGN)

  private static md5(input: string) {
    return crypto.hash("md5",input,"hex");
  }
  private static randomString(length: number=8){
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  public static async preSign(req: Request, res: Response) {
    let preSignKey = ServexHandler.randomString(16)

    let i = 0;
    while( await ServexHandler.preSignMap.get(preSignKey) !== null ){
      preSignKey = ServexHandler.randomString(16)
      if ( i++ > 5){
        return res.fail(500,"生成预签名Key失败，请稍后再试");
      }
    }
    const userId = req.token.id;
    await ServexHandler.preSignMap.set(preSignKey, userId, 60 * 60 * 24);
    res.success("presign key success",{
      preSign:preSignKey
    });
  }

  @ReqQueryCheck("url")
  public static async sign(req: Request, res: Response) {
    const url = <string>req.query['url'];
    const preSign = <string>req.params['key'];
    if( !preSign || preSign.length !== 16 ){
      return res.fail(900,"预签名Key错误");
    }
    const exist = await ServexHandler.preSignMap.get(preSign);
    Log.debug(`ServexHandler::sign variable presign:${preSign} exist:${exist}`)
    if( exist === null ){
      return res.fail(900,"预签名Key无效或已过期");
    }

    const path = "/" + url.split("/").slice(3).join("/");
    const rand = ServexHandler.randomString();
    const timeStamp = Math.floor(Date.now() / 1000);
    const uid = 0;
    const md5Hash = ServexHandler.md5(`${path}-${timeStamp}-${rand}-${uid}-${TENCENTCLOUD_CDN_PKEY}`);

    return res.redirect(`${url}?sign=${timeStamp}-${rand}-${uid}-${md5Hash}`)
  }

  public static async uploaderAccessRawPhoto(req: Request, res: Response) {
    const preSign = <string>req.params['key'];
    if( !preSign || preSign.length !== 16 ){
      return res.fail(400,"预签名Key错误");
    }
    const photoId = Number(req.params['id']);
    if (isNaN(photoId)){
      return res.fail(400, "照片ID错误");
    }

    const [key,photo] = await Promise.all([
      ServexHandler.preSignMap.get(preSign),
      Photo.getById(photoId),
    ])
    Log.debug(`Photo Access: ${photoId} by presign ${preSign}(${key})`)

    if( key === null ){
      return res.fail(400,"预签名Key无效或已过期");
    }
    if( !photo || photo.upload_user_id !== key ){
        return res.fail(403,"没有权限访问该照片");
    }
    req.query['url'] = getPhotoCDNUrl(photoId,true);
    return ServexHandler.sign(req,res);
  }
}
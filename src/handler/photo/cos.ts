import { PHOTO_COS_DOMAIN, TENCENTCLOUD_SECRET_ID, TENCENTCLOUD_SECRET_KEY } from "../../config.js";
import COSStorage from "../../service/cos/index.js";
import "dotenv/config";

const photoBucket = new COSStorage({
  secretId: TENCENTCLOUD_SECRET_ID,
  secretKey: TENCENTCLOUD_SECRET_KEY,
  bucket: process.env.PHOTO_BUCKET!,
  region: process.env.PHOTO_BUCKET_REGION!,
  domain: PHOTO_COS_DOMAIN,
});

export default photoBucket;

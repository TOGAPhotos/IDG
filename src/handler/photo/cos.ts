import COSStorage from "@/service/cos/index.js";
import "dotenv/config";

const photoBucket = new COSStorage({
  secretId: process.env.COS_SECRET_ID,
  secretKey: process.env.COS_SECRET_KEY,
  bucket: process.env.PHOTO_BUCKET,
  region: process.env.PHOTO_BUCKET_REGION,
  domain: process.env.PHOTO_COS_DOMAIN,
});

export default photoBucket;

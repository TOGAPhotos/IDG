import { cdn } from "tencentcloud-sdk-nodejs-cdn";
import { PHOTO_COS_CDN_DOMAIN, TENCENTCLOUD_SECRET_ID, TENCENTCLOUD_SECRET_KEY } from "../../config.js";
const cdnClient = cdn.v20180606.Client

export const CDNController = new cdnClient({
  credential: {
    secretId: TENCENTCLOUD_SECRET_ID,
    secretKey: TENCENTCLOUD_SECRET_KEY
  },
})

export const getPhotoCDNUrl = (key: string|number,raw=false): string => {
  return `https://${PHOTO_COS_CDN_DOMAIN}/photos/${key}.${raw?'raw':'jpg'}`
}

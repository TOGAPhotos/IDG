import { cdn } from "tencentcloud-sdk-nodejs-cdn";
import { PHOTO_COS_CDN_DOMAIN, TENCENTCLOUD_SECRET_ID, TENCENTCLOUD_SECRET_KEY } from "../../config.js";
import { EventBus } from "../../components/eventBus/indes.js";
import Log from "../../components/loger.js";

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

const refreshCDNPath = async (path: string[]): Promise<void> => {
    await CDNController.PurgeUrlsCache({
      Urls: path
    },
      (err, response) => {
        if (err) Log.error(err);
        else Log.info(`CDN refresh path success paths:${path.join(",")} requestId:${response.RequestId} taskId:${response.TaskId}`);
      }
    );
}

const eventBus = new EventBus()
eventBus.subscribe("photo:delete",(msg,data)=>{
  const { photoId } = data;
  return refreshCDNPath([
    getPhotoCDNUrl(photoId,true),
    getPhotoCDNUrl(photoId,false)
  ])
})
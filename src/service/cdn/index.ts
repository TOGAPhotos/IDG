import { cdn } from "tencentcloud-sdk-nodejs-cdn";
import {TENCENTCLOUD_SECRET_ID,TENCENTCLOUD_SECRET_KEY} from "../../config.js"
const cdnClient = cdn.v20180606.Client

export const cdnController = new cdnClient({
  credential: {
    secretId: TENCENTCLOUD_SECRET_ID,
    secretKey: TENCENTCLOUD_SECRET_KEY
  },
})

import Log from "@/components/loger.js";
import COS from "cos-nodejs-sdk-v5";
type CosParams = {
    secretId: string;
    secretKey: string;
    domain: string;
    bucket: string;
    region: string;
};

export default class COSStorage {
    private cos: COS;
    private bucket: string;
    private region: string;

    constructor({
        secretId,secretKey,
        domain,
        bucket,region,
    }: CosParams) {
        this.cos = new COS({
            SecretId: secretId,
            SecretKey: secretKey,
            Domain: domain,
        });
        this.bucket = bucket;
        this.region = region;
    }

    getUploadUrl(key:string) {
        return this.cos.getObjectUrl({
            Bucket: this.bucket,
            Region: this.region,
            Key: key,
            Method: 'PUT',
            Sign: true,
        },
        (err,data)=>{
            if(err){
                Log.error('COS Storage Error: Func getPhotoUploadUrl'+err.message);
                throw err;
            }
        });
    }

}

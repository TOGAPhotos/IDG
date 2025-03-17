import Log from "../../components/loger.js";
import COS from "cos-nodejs-sdk-v5";
type CosParams = {
    secretId: string;
    secretKey: string;
    domain: string;
    bucket: string;
    region: string;
};

export default class COSStorage extends COS {
    public readonly bucket: string;
    public readonly region: string;

    constructor({
        secretId,secretKey,
        domain,
        bucket,region,
    }: CosParams) {
        super({
            SecretId: secretId,
            SecretKey: secretKey,
            Domain: domain,
        })
        this.bucket = bucket;
        this.region = region;
    }

    getUploadUrl(key:string) {
        return this.getObjectUrl({
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

    // async deleteObject(key:string) {
    //     return this.delete({
    //         Bucket: this.bucket,
    //         Region: this.region,
    //         Key: key
    //     },(err,data)=>{
    //         if(err){
    //             Log.error('COS Storage Error: Func deleteObject'+err.message);
    //             throw err;
    //         }
    //     })
    // }

    streamDownload(key:string) {
        return this.getObjectStream({
            Bucket: this.bucket,
            Region: this.region,
            Key: key
        })
    }

    async upload(key:string,body:COS.UploadBody){
        return this.putObject({
            Bucket: this.bucket,
            Region: this.region,
            Key: key,
            Body:body
        })
    }

}

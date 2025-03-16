import Log from "../../components/loger.js";
import{ createCanvas,loadImage } from '@napi-rs/canvas';
import sharp from 'sharp';
import COSStorage from "../cos/index.js";
import 'dotenv/config';
import MessageQueueConsumer from "../messageQueue/consume.js";

type textConfig = {
    fontSize:number,
    fontFamily:string,
}
type watermarkConfig = {
    x:number,
    y:number,
    scale:number,
    alpha:number,
}

export class CopyrightOverlayConfig{
    public readonly inputFile:string;
    public readonly outputFile:string;
    public readonly username:string;
    public readonly watermark:watermarkConfig;
    public readonly textConfig:textConfig;

    constructor({
        file,
        fileSuffix,
        username,
        watermarkConfig,
        textConfig
    }:{
        file:string,
        fileSuffix:string,
        username:string,
        watermarkConfig:watermarkConfig,
        textConfig?:textConfig
    }){
        this.inputFile = file;
        this.outputFile = file+fileSuffix
        this.username = username;
        this.watermark = watermarkConfig;
        
        if(textConfig){
            this.textConfig = textConfig;
        }else{
            this.textConfig = {fontSize:16,fontFamily:"Source Han Sans CN"}
        }
    }
}

export class ImageProcess{

    static cos = new COSStorage({
        secretId: process.env.COS_SECRET_ID,
        secretKey: process.env.COS_SECRET_KEY,
        bucket: process.env.PHOTO_BUCKET,
        region: process.env.PHOTO_BUCKET_REGION,
        domain: process.env.PHOTO_COS_DOMAIN,
    });

    private static async $createCopyrightOverlay (
        width:number,
        height:number,
        username:string,
        watermarkConfig:watermarkConfig,
        textConfig:textConfig
    ){
        Log.debug(JSON.stringify(textConfig.fontSize))
        const _text = `图片版权归属 ${username}`
        const canvas = createCanvas(width, height+20);
        const ctx = canvas.getContext('2d')
    
        const watermarkImg = await loadImage("https://cos-0688-tp-cdn.794td.cn/watermark_testing.png")
        
        ctx.fillStyle = 'rgba(255,255,255,0)'
        ctx.fillRect(0,0,canvas.width,canvas.height)
    
        ctx.globalAlpha = watermarkConfig.alpha
        ctx.drawImage(watermarkImg,watermarkConfig.x,watermarkConfig.y,watermarkImg.width*watermarkConfig.scale,watermarkImg.height*watermarkConfig.scale)
        
        ctx.globalAlpha = Math.min(1,watermarkConfig.alpha + 0.1)
        ctx.fillStyle = 'white'
        const overlayFontSize = watermarkImg.height*watermarkConfig.scale / 4
        ctx.font = `${overlayFontSize}px ${textConfig.fontFamily}`
        ctx.fillText(
            `©️ ${username}`,
            watermarkConfig.x,
            watermarkConfig.y + watermarkImg.height*watermarkConfig.scale + overlayFontSize,
        )
    
        ctx.globalAlpha = 1
        ctx.fillStyle = 'black'
        ctx.fillRect(0,height,width,20)
        ctx.fillStyle = 'white'
        ctx.font = `${textConfig.fontSize}px ${textConfig.fontFamily}`
        const {width:textWidth} = ctx.measureText(_text)
        const textLineHeight = height+16
        ctx.fillText("TOGAPhotos",5,textLineHeight);
        ctx.fillText(_text,(width-textWidth-5),textLineHeight);
        return canvas.toBuffer('image/png')
    }



    static async copyrightOverlay(config:CopyrightOverlayConfig){
        Log.debug(`ImageProcess: ${config.inputFile} -> ${config.outputFile}`);
        const downloadStream = ImageProcess.cos.streamDownload(config.inputFile);
        const image = sharp();
        downloadStream.pipe(image);
        const { width,height,format } = await image.metadata();
        if( !width || !height || !format){
            throw new Error("图片信息获取失败")
        }
        Log.debug(JSON.stringify(config.textConfig))
        const overlay = await ImageProcess.$createCopyrightOverlay(
            width,height,
            config.username,
            config.watermark,
            config.textConfig
        );
        const imageBuffer = await image.extend({bottom:20})
        .composite([
            {input:overlay, top:0, left:0},
        ])
        .toFormat(format)
        .withMetadata()
        .toBuffer()

        const uploadResult = await ImageProcess.cos.upload(config.outputFile,imageBuffer);
        return uploadResult;
    }
}

const mq = new MessageQueueConsumer("imageProcess");
mq.consume(async (msg) => {
    Log.debug(msg.content.toString());
    const {task,params}:{task:string,params:CopyrightOverlayConfig} = JSON.parse(msg.content.toString());
    if(task === 'T1-copyrightOverlay'){
        try{
            Log.debug(`ImageProcess: ${params.inputFile} -> ${params.outputFile}`);
            await ImageProcess.copyrightOverlay(params);
        }catch(e){
            Log.debug(e)
            throw new Error(JSON.stringify(e));
        }
    }
});
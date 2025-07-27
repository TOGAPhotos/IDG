import Log from "../../components/loger.js";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import sharp from "sharp";
import COSStorage from "../cos/index.js";
import "dotenv/config";
import MessageQueueConsumer from "../messageQueue/consume.js";
import HandlerError from "../messageQueue/erroe.js";
import Photo from "../../dto/photo.js";

type textConfig = {
  fontSize: number;
  fontFamily: string;
};
type watermarkConfig = {
  x: number;
  y: number;
  scale: number;
  alpha: number;
};

type CopyrightOverlayConfig =
  | InstanceType<typeof FileCopyrightOverlayConfig>
  | InstanceType<typeof PhotoCopyrightOverlayConfig>;

export class FileCopyrightOverlayConfig {
  public readonly inputFile: string;
  public readonly outputFile: string;
  public readonly username: string;
  public readonly watermark: watermarkConfig;
  public readonly textConfig: textConfig;

  constructor({
    file,
    outputFile,
    username,
    watermarkConfig,
    textConfig,
  }: {
    photoId?: number | null;
    file: string;
    outputFile: string;
    username: string;
    watermarkConfig: watermarkConfig;
    textConfig?: textConfig;
  }) {
    this.inputFile = file;
    this.outputFile = outputFile;
    this.username = username;
    this.watermark = watermarkConfig;

    this.textConfig = textConfig || {
      fontSize: 20,
      fontFamily: "Source Han Sans CN",
    };
  }
}

export class PhotoCopyrightOverlayConfig extends FileCopyrightOverlayConfig {
  public readonly photoId: number;

  constructor({
    photoId,
    username,
    watermarkConfig,
    textConfig,
  }: {
    photoId: number;
    username: string;
    watermarkConfig: watermarkConfig;
    textConfig?: textConfig;
  }) {
    super({
      file: `photos/${photoId}.raw`,
      outputFile: `photos/${photoId}.jpg`,
      username: username,
      watermarkConfig: watermarkConfig,
      textConfig: textConfig,
    });
    this.photoId = photoId;
  }
}

export class ImageProcess {
  static cos = new COSStorage({
    secretId: process.env.COS_SECRET_ID,
    secretKey: process.env.COS_SECRET_KEY,
    bucket: process.env.PHOTO_BUCKET,
    region: process.env.PHOTO_BUCKET_REGION,
    domain: process.env.PHOTO_COS_DOMAIN,
  });

  private static async $createCopyrightOverlay(
    width: number,
    height: number,
    username: string,
    watermarkConfig: watermarkConfig,
    textConfig: textConfig,
  ) {
    const _text = `图片版权归属 ${username}`;
    const canvas = createCanvas(width, height + 20);
    const ctx = canvas.getContext("2d");
    const watermarkImg = await loadImage(
      "https://cos-0688-tp-cdn.794td.cn/watermark_testing.png",
    );

    // prepare a transparent background with same width and height +20px
    ctx.fillStyle = "rgba(255,255,255,0)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // draw watermark
    ctx.globalAlpha = watermarkConfig.alpha;
    ctx.drawImage(
      watermarkImg,
      watermarkConfig.x,
      watermarkConfig.y,
      watermarkImg.width * watermarkConfig.scale,
      watermarkImg.height * watermarkConfig.scale,
    );

    // prepare work for the overlay text
    ctx.globalAlpha = Math.min(1, watermarkConfig.alpha + 0.1); // on purpose
    ctx.fillStyle = "white";
    let overlayFontSize = (watermarkImg.height * watermarkConfig.scale) / 4;
    ctx.font = `${overlayFontSize}px ${textConfig.fontFamily}`;
    const watermarkText = `©️ ${username}`;
    const watermarkTextWidth = ctx.measureText(watermarkText).width;

    // make sure the length of the Text no longer than the watermark
    while (watermarkTextWidth > watermarkImg.width * watermarkConfig.scale) {
      overlayFontSize -= 1;
      ctx.font = `${overlayFontSize}px ${textConfig.fontFamily}`;
      const { width: _w } = ctx.measureText(watermarkText);
      if (
        _w <= watermarkImg.width * watermarkConfig.scale ||
        overlayFontSize < 2
      ) {
        break;
      }
    }

    // fill Text below the watermark
    ctx.fillText(
      watermarkText,
      watermarkConfig.x,
      watermarkConfig.y +
        watermarkImg.height * watermarkConfig.scale +
        overlayFontSize,
    );

    //fill Text below the image
    ctx.globalAlpha = 1;
    ctx.fillStyle = "black";
    ctx.fillRect(0, height, width, 20);
    ctx.fillStyle = "white";
    ctx.font = `${textConfig.fontSize}px ${textConfig.fontFamily}`;
    const { width: textWidth } = ctx.measureText(_text);
    const textLineHeight = height + 16;
    ctx.fillText("TOGAPhotos", 5, textLineHeight);
    ctx.fillText(_text, width - textWidth - 5, textLineHeight);
    return canvas.toBuffer("image/png");
  }

  static async copyrightOverlay(config: CopyrightOverlayConfig) {
    Log.debug(`ImageProcess: ${config.inputFile} -> ${config.outputFile}`);
    try {
      const downloadStream = ImageProcess.cos.streamDownload(config.inputFile);
      downloadStream.on("error", (e) => {
        throw new HandlerError(`图片${config.inputFile}下载失败: ${e.message}`);
      });
      const image = sharp();
      downloadStream.pipe(image);
      const { width, height, format } = await image.metadata();
      if (!width || !height || !format) {
        throw new HandlerError("图片信息获取失败");
      }
      const overlay = await ImageProcess.$createCopyrightOverlay(
        width,
        height,
        config.username,
        config.watermark,
        config.textConfig,
      );
      const imageBuffer = await image
        .extend({ bottom: 20 })
        .composite([{ input: overlay, top: 0, left: 0 }])
        .toFormat(format, { quality: 100 })
        .withMetadata()
        .toBuffer();
      await ImageProcess.cos.upload(config.outputFile, imageBuffer);
      if ("photoId" in config) {
        await Photo.update(config.photoId, { storage_status: "COMPLETE" });
      }
    } catch (e) {
      if ("photoId" in config) {
        await Photo.update(config.photoId, {
          storage_status: "ERROR:CP_OVERLAY",
        });
      }
      throw new HandlerError(`图片${config.inputFile}处理失败: ${e.message}`);
    }
  }
}

const mq = new MessageQueueConsumer("imageProcess");
mq.consume(async (msg) => {
  Log.debug(msg.content.toString());
  const { task, params }: { task: string; params: CopyrightOverlayConfig } =
    JSON.parse(msg.content.toString());
  switch (task) {
    case "T1-copyrightOverlay":
      await ImageProcess.copyrightOverlay(params);
      break;
    default:
      throw new HandlerError("Unknown task");
  }
});

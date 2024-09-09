import gm from 'gm';
import Log from "@/components/loger.js";
import { parentPort } from 'worker_threads';

export class ImageProcess{

    static async GetImageSize(url: string): Promise<gm.Dimensions>{
        return await new Promise<gm.Dimensions>(
            (resolve, reject) => gm(url).size((err, size) => err ? reject(err) : resolve(size))
        );
    }

    static async CreateThumbnail(url:string){
        const outputImg  = url.split(".")[0] + "_min." + url.split(".")[1]
        const {width,height} = await ImageProcess.GetImageSize(url)
        const minH = Math.round((width * 9) / 16);
        const startY = Math.round((height - 20 - minH) / 2);

        await new Promise<void>((resolve, reject) => {
            gm(url)
                .crop(width, minH, 0, startY)
                .resize(480)
                .write(
                    `${outputImg}`,
                    (err) => err ? reject(err) : resolve()
                )
        })
    }

    static async ThumbnailTask(url:string){
        try{
            await ImageProcess.CreateThumbnail(url);
            parentPort.postMessage({url, status: 'success'});
        }catch(e){
            Log.error("Create Thumbnail Error " + e.message);
            parentPort.postMessage({url, status: 'error'});
        }

    }
}

parentPort.on('message', async (url:string) => ImageProcess.ThumbnailTask(url)); 


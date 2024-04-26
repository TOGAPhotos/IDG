import gm from 'gm';
import {photoBaseFolder} from '../config.js';
import Log from "./loger.js";

export async function GetMinImage(url: string) {

    let w: number, h: number
    let minH: number, startY: number;

    await new Promise<void>((resolve, rejects) => {
        gm(photoBaseFolder + url)
            .size((err, size) => {
                if (err) {
                    Log.error("Compress Error " + err.message)
                    rejects()
                }
                h = size.height
                w = size.width
                resolve()
            })
    })

    minH = Math.round((w * 9) / 16);
    startY = Math.round((h - 20 - minH) / 2);
    gm(photoBaseFolder + url)
        .crop(w, minH, 0, startY)
        .write(
            `${photoBaseFolder}/min${url}`,
            err => {
                if (err) {
                    Log.error("Compress Error " + err.message)
                }
            }
        )
}
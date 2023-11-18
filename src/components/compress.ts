import gm from 'gm';
import {photoBaseFolder} from '../config.js';
import {Logger} from "./loger.js";

export function GetMinImage(url: string) {

    let w: number, h: number
    let min_h: number, start_y: number;

    new Promise<void>((resolve, rejects) => {
        gm(photoBaseFolder + url)
            .size((err, size) => {
                if (err) {
                    Logger.error(err)
                    rejects()
                }
                h = size.height
                w = size.width
                resolve()
            })
        }).then(
            () => {
                min_h = Math.round((w * 9) / 16);
                start_y = Math.round((h - 20 - min_h) / 2);
                gm(photoBaseFolder + url)
                    .crop(w, min_h, 0, start_y)
                    .resize(432, 243)
                    .write(`${photoBaseFolder}/min${url}`, function (err) {
                        if (err) {
                            Logger.error(err)
                        }
                    });
            }
        )

}
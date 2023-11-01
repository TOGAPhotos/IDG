import gm from 'gm';
import { photoBaseFolder } from '../config.js';

// function CompressMinPhoto(url:string, w:number, h:number) {
//     let min_h = Math.round((w * 9) / 16);
//     let start_y = Math.round((h - 20 - min_h) / 2);

//     gm(photoBaseFolder + url)
//         .crop(w, min_h, 0, start_y)
//         .resize(432, 243)
//         .write(`${photoBaseFolder}/min${url}`, function (err) {
//             if (err) {
//                 console.log(err);
//             }
//         });
// }

export function GetMinImage(url:string) {


    // imageSize(photoBaseFolder + url, function (err, sizeInfo) {
    //     if (err) {
    //         return console.log(err);
    //     }
    //     CompressMinPhoto(url, sizeInfo.width, sizeInfo.height);
    // });
    // const imageSize = sizeOf(photoBaseFolder + url);

    // const size = imageSize()

    let w:number,h:number

    gm(photoBaseFolder + url)
    .size((err,size)=>{
        h = size.height
        w = size.width
    })

    let min_h = Math.round((w * 9) / 16);
    let start_y = Math.round((h - 20 - min_h) / 2);

    gm(photoBaseFolder + url)
    .crop(w, min_h, 0, start_y)
    .resize(432, 243)
    .write(`${photoBaseFolder}/min${url}`, function (err) {
        if (err) {
            console.log(err);
        }
    });

}
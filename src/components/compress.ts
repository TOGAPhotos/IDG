import gm from 'gm';

export async function GetMinImage(url: string) {

    const outputImg  = url.split(".")[0] + "_min." + url.split(".")[1]

    const {width,height} = await new Promise<gm.Dimensions>(
        (resolve, reject) => gm(url).size((err, size) => err ? reject(err) : resolve(size))
    );
    const minH = Math.round((width * 9) / 16);
    const startY = Math.round((height - 20 - minH) / 2);

    await new Promise((resolve, reject)=>{
        gm(url)
        .crop(width, minH, 0, startY)
        .resize(480)
        .write(
            `${outputImg}`,
            (err) => err ? reject(err) :resolve
        )
    })

}
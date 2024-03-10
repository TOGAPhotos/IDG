import { Request, Response } from "express";
import Photo from "../../dto/photo.js";

export async function GetPhoto(req: Request, res: Response) {

    const id = Number(req.params['id']);

    const photoInfo = await Photo.getById(id);

    if(photoInfo === null){
        return res.status(HTTP_STATUS.NOT_FOUND).json({message:"图片不存在"});
    }

    return res.json({message:"成功",photoInfo});

}

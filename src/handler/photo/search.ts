import { Request,Response } from "express";
import Photo from "../../dto/photo.js";

export async function SearchPhoto(req:Request, res:Response) {
    const type = req.query['type'] as string;
    const keyword = req.query['keyword'] as string;
    let lastId:number = Number(req.query['lastId']);

    if(isNaN(lastId)){
        lastId = -1;
    }
    console.log(lastId,typeof (lastId));

    let result;

    switch (type) {
        case 'reg':
            result = await Photo.searchByRegKeyword(keyword, lastId);
            break;
        case 'airline':
            result = await Photo.searchByAirlineKeyword(keyword, lastId);
            break;
        case 'airport':
            result = await Photo.searchByAirportKeyword(keyword, lastId);
            break;
        case 'user':
            result = await Photo.searchByUserKeyword(keyword, lastId);
            break;
        default:
            throw new Error('Search Type');
    }


    return res.json({message: '查询成功', data: result});

}
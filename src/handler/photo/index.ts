import fs from "fs/promises";
import {Request, Response} from "express";
import Log from "../../components/loger.js";

import User from "../../dto/user.js";
import Photo from "../../dto/photo.js";
import Permission from "../../components/auth/permissions.js";

import {photoBaseFolder} from "../../config.js";
import multer from "multer";

export default class PhotoHandler {

    private static readonly photoFolder = `${photoBaseFolder}/photos`;

    static async get(req: Request, res: Response) {
        const id = Number(req.params['id']);
        const photoInfo = await Photo.getAcceptById(id);

        if (photoInfo === null) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({message: "图片不存在"});
        }
        return res.json({message: "成功", photoInfo});
    }

    static async getList(req: Request, res: Response) {
        let lastId = Number(req.query['lastId']);
        const list = await Photo.getAcceptPhotoList(lastId);
        return res.json({message:'查询成功',data: list});
    }

    static async search(req: Request, res: Response) {
        const type = req.query['type'] as string;
        const keyword = req.query['keyword'] as string;
        let lastId:number = Number(req.query['lastId']);

        if(isNaN(lastId)){
            lastId = -1;
        }

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

    static storage = multer.diskStorage({
        destination: function (req, file, callback) {
            callback(null, photoBaseFolder + '/photos');
        },
        filename: async function (req, file, callback) {
            const d = new Date();
            const dbResult = await Photo.create({
                userId: req.token.id,
                uploadTime: new Date(),
                reg: req.body["reg"],
                msn: req.body["msn"],
                picType: req.body["picType"],
                airport: req.body["airport"],
                airline: req.body["airline"],
                airtype: req.body["airtype"],
                photoTime: new Date(req.body["photoDate"]),
                remark: req.body["remark"],
                allowSocialMedia:(req.body['allowSocialMedia'] === '1')
            });
            const photoId = dbResult.id
            // req.body['photoId'] = photoId;
            callback(null, `${photoId}.jpg`);
        }
    });

    static async upload(req: Request, res: Response) {
        const userInfo = await User.getById(req.token.id)
        if (
            userInfo.free_queue <= 0 ||
            (req.body['queue'] === 'PRIORITY'
                && userInfo.free_priority_queue <= 0)
        ) {

            return res.status(HTTP_STATUS.BAD_REQUEST).json({message: '无剩余队列'});
        }

    }

    static async delete(req: Request, res: Response) {
        const userId = req.token.id;
        const photoId = Number(req.params['id']);

        const userInfo = await User.getById(userId);
        const photoInfo = await Photo.getById(photoId);

        Log.info(`access_id:${req.uuid} user_id:${userId} username:${userInfo['username']} 尝试删除图片 ${photoId}`);

        if (photoInfo.is_delete) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({message: "已删除"});
        }

        if (
            !(Permission.checkUserPermission(userInfo.role, Permission.screener1) ||
                userId === photoInfo.upload_user_id)
        ) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({message: "您没有权限删除图片"});
        }

        await Photo.deleteById(photoId);
        try {
            await fs.unlink(`${this.photoFolder}/${photoId}.jpg`);
            if (photoInfo.status === 'ACCEPT') {
                await fs.unlink(`${photoBaseFolder}/min/photos/${photoId}.jpg`);
            }
        } catch (e) {
            Log.error(e)
        }

        if (photoInfo.status === 'WAIT SCREEN') {
            let data = {free_queue: {increment: 1}}
            if (photoInfo.queue_type === "PRIORITY") {
                data["free_priority_queue"] = {increment: 1}
            }
            await User.updateById(userId, data);
        }

        return res.json({message: '删除成功'});
    }
}
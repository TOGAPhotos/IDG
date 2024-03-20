import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import nodeSchedule from "node-schedule";
export default class WebsiteHandler{
    private static photoList = [];
    private static randomPhotoList = [];
    private static userNum = 0;
    private static uploadQueueLen = 0;
    private static photoNum = 0;
    private static prisma = new PrismaClient()

    private static async updatePhotoList(){
        WebsiteHandler.photoList = await this.prisma.accept_photo.findMany({take:40,orderBy:{upload_time:'desc'}})
        WebsiteHandler.randomPhotoList = await this.prisma.$queryRawUnsafe(`SELECT * FROM accept_photo ORDER BY RAND() LIMIT 8`)

    }

    private static async updateBasicInfo(){
        console.log('update basic info')
        WebsiteHandler.userNum = await this.prisma.user.count({where:{is_deleted:false}})
        WebsiteHandler.uploadQueueLen = await this.prisma.photo_queue.count()
        WebsiteHandler.photoNum = await this.prisma.accept_photo.count()
    }

    static async scheduleUpdate(){
        await WebsiteHandler.updatePhotoList()
        await WebsiteHandler.updateBasicInfo()
        nodeSchedule.scheduleJob('0 */5 * * * *', async ()=>{
            await WebsiteHandler.updatePhotoList()
            await WebsiteHandler.updateBasicInfo()
        })
    }
    static async get(req:Request,res:Response){
        res.json({message:'成功',homepageInfo: {
            photoList: WebsiteHandler.photoList,
            userNum: WebsiteHandler.userNum,
            uploadQueueLen: WebsiteHandler.uploadQueueLen,
            photoNum: WebsiteHandler.photoNum,
            randomPhotoList: WebsiteHandler.randomPhotoList,
        }});
    }

}
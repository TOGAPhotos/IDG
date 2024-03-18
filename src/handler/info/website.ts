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
        this.photoList = await this.prisma.accept_photo.findMany({take:40,orderBy:{upload_time:'desc'}})
        this.randomPhotoList = await this.prisma.$queryRawUnsafe(`SELECT * FROM accept_photo ORDER BY RAND() LIMIT 8`)
    }

    private static async updateBasicInfo(){
        this.userNum = await this.prisma.user.count({where:{is_deleted:false}})
        this.uploadQueueLen = await this.prisma.photo_queue.count()
        this.photoNum = await this.prisma.accept_photo.count()
    }

    private static scheduleUpdate(){
        nodeSchedule.scheduleJob('0 */5 * * * *', async ()=>{
            await this.updatePhotoList()
            await this.updateBasicInfo()
        })
    }
    static async get(req:Request,res:Response){
        res.json({message:'成功',homepageInfo: {
            photoList: this.photoList,
            userNum: this.userNum,
            uploadQueueLen: this.uploadQueueLen,
            photoNum: this.photoNum,
            randomPhotoList: this.randomPhotoList,
        }});
    }

}
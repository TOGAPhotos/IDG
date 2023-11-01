import {PrismaClient} from "@prisma/client";
import { Request,Response,NextFunction } from "express";

const prisma = new PrismaClient();

let randomPhotoList = [];

const homepageInfo = {
    photoList: [],
    userNum: 0,
    uploadQueueLen: 0,
    photoNum: 0,
    randomPhoto: {},//下版本中删除 
    randomPhotoList: []
};

export async function GetWebsiteInfo(req:Request, res:Response) {
    
    //下版本中删除 
    homepageInfo.randomPhoto = randomPhotoList[Math.floor(Math.random() * randomPhotoList.length)];
    
    homepageInfo.randomPhotoList = randomPhotoList;
    return res.json({message:'成功',homepageInfo: homepageInfo});
}

export async function GetPhotoList() {
    homepageInfo.photoList = await prisma.$queryRawUnsafe(
        `SELECT a.id, photo_url, airtype, reg, airline, username
         FROM (SELECT *
               FROM photo
               WHERE is_delete = 0
                 AND in_upload_queue = 0
                 AND result = 1
               ORDER BY upload_time DESC
               LIMIT 40) AS a
                  LEFT JOIN user AS c ON c.id = a.uploader
        `);
    console.log("CALL FUNCTION GetPhotoList");
}

export async function GetStatisticalData() {
    let userNum = await prisma.$queryRawUnsafe(
        'SELECT COUNT(id) AS user_num FROM user WHERE is_deleted = false'
    );
    homepageInfo.userNum = Number(userNum[0]['user_num']);
    let uploadQueueLen = await prisma.$queryRawUnsafe(
        'SELECT COUNT(id) AS upload_queue_len FROM upload_queue WHERE screener_2 IS null AND is_delete = 0'
    );
    homepageInfo.uploadQueueLen = Number(uploadQueueLen[0]['upload_queue_len']);
    let photoNum = await prisma.$queryRawUnsafe(
        'SELECT COUNT(id) AS photo_num FROM photo WHERE is_delete = 0 AND result = 1'
    );
    homepageInfo.photoNum = Number(photoNum[0]['photo_num']);
    console.log("CALL FUNCTION GetStatisticalData");

}

export async function GetRandomPhoto() {
    randomPhotoList = await prisma.$queryRawUnsafe(`
        SELECT a.id, photo_url, b.username, reg, airline,airtype
        FROM photo AS a,
             user AS b
        WHERE is_delete = 0
          AND in_upload_queue = 0
          AND result = 1
          AND a.uploader = b.id
        ORDER BY RAND()
        LIMIT 5`);
    console.log("CALL FUNCTION GetRandomPhoto");
}
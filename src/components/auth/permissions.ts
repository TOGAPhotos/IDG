import { Request,Response,NextFunction } from "express";
import {PrismaClient} from "@prisma/client";

const prisma = new PrismaClient();

export function IsLogin(req:Request,res:Response,next:NextFunction){
    if( !req.token ){
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({message:"请先登录"})
    }
    next()
}

async function ChekUserStatus(userId:number,role:number):Promise<number>{
    const userInfo = await prisma.user.findUnique({where:{id:userId}});
    if( userInfo.status !== 0 ){
        return -1;
    }
    if(userInfo.is_deleted){
        return -1
    }
    if(userInfo.role < role){
        return -1
    }
    return userInfo.role
}

export async function IsScreener(req:Request,res:Response,next:NextFunction){
    const screener = await ChekUserStatus(req.token.id,USER_ROLE.screener);
    if( screener === -1){
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({message:"没有权限"})
    }
    req.role = screener;
    next()
}

export async function IsAdmin(req:Request,res:Response,next:NextFunction){
    const admin = await ChekUserStatus(req.token.id,3);
    if( admin === -1){
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({message:"没有权限"})
    }
    req.role = admin;
    next()
}
import { Request,Response,NextFunction } from "express";
import {PrismaClient} from "@prisma/client";
import {User, UserData} from "../../dto/user.js";

const prisma = new PrismaClient();
const ROLE_LIST = ["USER","MEDIA","DATABASE","SCREENER_1","SCREENER_2","ADMIN"];

export function IsLogin(req:Request,res:Response,next:NextFunction){
    if( !req.token ){
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({message:"请先登录"})
    }
    next()
}
export function CheckUserStatus(User){
    if (User.status === "BLOCK") {
        return false;
    }
    if (User.is_deleted) {
        return false;
    }
    return true;
}

function CheckUserPermission(userRole:string,requiredRole:string):boolean{

    const userRoleIndex = ROLE_LIST.indexOf(userRole);
    const requiredRoleIndex = ROLE_LIST.indexOf(requiredRole);

    return userRoleIndex >= requiredRoleIndex;
}

export async function IsScreener(req:Request,res:Response,next:NextFunction){
    const userInfo = await User.getUserById(req.token.id);

    if( !CheckUserStatus(userInfo) ){
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({message:"用户状态异常"})
    }
    if( !CheckUserPermission(userInfo.role, "SCREENER_1") ){
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({message:"没有权限"})
    }

    req.role = userInfo.role;
    next()
}

export async function IsAdmin(req:Request,res:Response,next:NextFunction){
    const userInfo = await User.getUserById(req.token.id);

    if( !CheckUserStatus(userInfo) ){
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({message:"用户状态异常"})
    }
    if( !CheckUserPermission(userInfo.role, "ADMIN") ){
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({message:"没有权限"})
    }

    req.role = userInfo.role;
    next()
}
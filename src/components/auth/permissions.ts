import { Request,Response,NextFunction } from "express";
import User from "../../dto/user.js";

export default class Permission{

    static readonly user = "USER";
    static readonly media = "MEDIA";
    static readonly database = "DATABASE";
    static readonly screener1 = "SCREENER_1";
    static readonly screener2 = "SCREENER_2";
    static readonly admin = "ADMIN";
    static readonly ROLE_LIST = [this.user,this.media,this.database,this.screener1,this.screener2,this.admin];

    static checkUserPermission(userRole:string,requiredRole:string):boolean{

        const userRoleIndex = this.ROLE_LIST.indexOf(userRole);
        const requiredRoleIndex = this.ROLE_LIST.indexOf(requiredRole);

        return userRoleIndex >= requiredRoleIndex;
    }

    static isUser(userRole:string){
        return userRole === this.user;
    }

    static isStaff(userRole:string){
        return this.ROLE_LIST.indexOf(userRole) > this.ROLE_LIST.indexOf(this.user);
    }

    static isMedia(userRole:string){
        return userRole === this.media;
    }


    static isSeniorScreener(userRole:string){
        return userRole === this.screener2;
    }
    static isDatabase(userRole:string){
        return userRole === this.database;
    }

    static isLoginMW (req:Request, res:Response, next:NextFunction){
        if( !req.token ){
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({message:"请先登录"})
        }
        next()
    }

    static async isScreenerMW(req:Request, res:Response, next:NextFunction){
        const userInfo = await User.getById(req.token.id);

        if( !this.checkUserStatus(userInfo) ){
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({message:"用户状态异常"})
        }
        if( !Permission.checkUserPermission(userInfo.role, "SCREENER_1") ){
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({message:"没有权限"})
        }

        req.role = userInfo.role;
        next()
    }
    static async isAdminMW(req:Request, res:Response, next:NextFunction){
        const userInfo = await User.getById(req.token.id);

        if( !this.checkUserStatus(userInfo) ){
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({message:"用户状态异常"})
        }
        if( !Permission.checkUserPermission(userInfo.role, "ADMIN") ){
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({message:"没有权限"})
        }

        req.role = userInfo.role;
        next()
    }

    static checkUserStatus(user:any){
        if(user === null){
            return false;
        }
        if (user.status === "BLOCK") {
            return false;
        }
        if (user.is_deleted) {
            return false;
        }
        return true;
    }
    static async checkUserStatusMW(req:Request, res:Response, next:NextFunction){
        const userInfo = await User.getById(req.token.id);
        if( !this.checkUserStatus(userInfo) ){
            return res.status(HTTP_STATUS.FORBIDDEN).json({message:"用户状态异常"})
        }
        next()
    }

}

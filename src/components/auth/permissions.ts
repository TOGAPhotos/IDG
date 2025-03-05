import { Request,Response,NextFunction } from "express";
import User from "../../dto/user.js";
import { HTTP_STATUS } from "../../types/http_code.js";

export default class Permission{

    static readonly user = "USER";
    static readonly media = "MEDIA";
    static readonly database = "DATABASE";
    static readonly screener1 = "SCREENER_1";
    static readonly screener2 = "SCREENER_2";
    static readonly admin = "ADMIN";
    static readonly ROLE_LIST = [Permission.user,Permission.media,Permission.database,Permission.screener1,Permission.screener2,Permission.admin];

    static checkUserPermission(userRole:string,requiredRole:string):boolean{

        const userRoleIndex = Permission.ROLE_LIST.indexOf(userRole);
        const requiredRoleIndex = Permission.ROLE_LIST.indexOf(requiredRole);

        return userRoleIndex >= requiredRoleIndex;
    }

    static isUser(userRole:string){
        return userRole === Permission.user;
    }

    static isStaff(userRole:string){
        return Permission.ROLE_LIST.indexOf(userRole) > Permission.ROLE_LIST.indexOf(Permission.user);
    }

    static isMedia(userRole:string){
        return Permission.checkUserPermission(userRole,Permission.media);
    }

    static isScreener(userRole:string){
        return Permission.checkUserPermission(userRole,Permission.screener1);
    }

    static isSeniorScreener(userRole:string){
        return Permission.checkUserPermission(userRole,Permission.screener2);
    }
    static isDatabase(userRole:string){
        return Permission.checkUserPermission(userRole,Permission.database);
    }

    static isLoginMW (req:Request, res:Response, next:NextFunction){
        if( !req.token ){
            return res.fail(HTTP_STATUS.UNAUTHORIZED,"未登录")
        }
        next()
    }

    static async isStaffMW(req:Request, res:Response, next:NextFunction){
        const userInfo = await User.getById(req.token.id);

        if( !Permission.checkUserStatus(userInfo) ){
            return res.fail(HTTP_STATUS.UNAUTHORIZED,"用户状态异常")
        }
        if( !Permission.isStaff(userInfo.role) ){
            return res.fail(HTTP_STATUS.UNAUTHORIZED)
        }

        req.role = userInfo.role;
        next()
    }

    static async isScreenerMW(req:Request, res:Response, next:NextFunction){
        const userInfo = await User.getById(req.token.id);

        if( !Permission.checkUserStatus(userInfo) ){
            return res.fail(HTTP_STATUS.UNAUTHORIZED,"用户状态异常")
        }
        if( !Permission.isScreener(userInfo.role) ){
            return res.fail(HTTP_STATUS.UNAUTHORIZED)
        }

        req.role = userInfo.role;
        next()
    }

    static async isSeniorScreenerMW(req:Request, res:Response, next:NextFunction){
        const userInfo = await User.getById(req.token.id);

        if( !Permission.checkUserStatus(userInfo) ){
            return res.fail(HTTP_STATUS.UNAUTHORIZED,"用户状态异常")
        }
        if( !Permission.isSeniorScreener(userInfo.role) ){
            return res.fail(HTTP_STATUS.UNAUTHORIZED)
        }

        req.role = userInfo.role;
        next()
    }

    static async isAdminMW(req:Request, res:Response, next:NextFunction){
        const userInfo = await User.getById(req.token.id);

        if( !Permission.checkUserStatus(userInfo) ){
            res.fail(HTTP_STATUS.UNAUTHORIZED,"用户状态异常")
        }
        if( !Permission.isSeniorScreener(userInfo.role) ){
            res.fail(HTTP_STATUS.UNAUTHORIZED)
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
        if( !Permission.checkUserStatus(userInfo) ){
            res.fail(HTTP_STATUS.UNAUTHORIZED,"用户状态异常")
        }
        next()
    }

}

import { Request,Response } from "express";
// import {PrismaClient} from "@prisma/client";
import prisma from "./prisma.js";
import { md5 } from "../../components/crypto.js";
import { CreateToken } from "../../components/auth/token.js";
import { GetTimeStamp } from "../../components/time.js";
import { TokenExpireTime } from "../../config.js";

// const prisma = new PrismaClient();
export async function Login(req:Request,res:Response){
    
    let {email,password}:{email:string,password:string} = req.body;
    
    if (!email || !password) {
        return res.status(406).json({message: '邮箱或密码不合法'});
    }

    const user = await prisma.user.findMany({
        where: {
            user_email:email,
            is_deleted:false,
        }
    })

    if(user.length === 0){
        return res.status(HTTP_STATUS.BAD_REQUEST).json({message: '账户不存在'})
    }

    const userInfo = user[0];

    if(userInfo.password !== md5(password)){
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({message: '密码错误'});
    }

    if(userInfo.status !== 0){
        return res.status(HTTP_STATUS.FORBIDDEN).json({message: '账户已被禁用'});
    }

    return res.json({
        message: '登录成功',
        token:CreateToken(userInfo.id),
        expireTime:GetTimeStamp() + TokenExpireTime*1000,
        id:userInfo.id,
        username:userInfo.username,
        permission:userInfo.role,
    })
}
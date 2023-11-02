import { Request,Response } from "express";
// import {PrismaClient} from "@prisma/client";
import prisma from "./prisma.js";
import { emailRegex } from "../../components/regexp.js";
import { error } from "console";
import { md5 } from "../../components/crypto.js";
import { CreateToken } from "../../components/auth/token.js"

// const prisma = new PrismaClient();

export async function Register(req:Request,res:Response){
    let {email,username,password,passwordR}:{email:string,username:string,password:string,passwordR:string} = req.body;
    
    // 基础检查
    if( !emailRegex.test(email) ){
        return res.status(HTTP_STATUS.OK).json({message: '邮箱格式错误'});
    }
    if(password !== passwordR){
        return res.status(HTTP_STATUS.BAD_REQUEST).json({message: '两次密码不一致'});
    }
    if(username.length > 20){
        return res.status(HTTP_STATUS.BAD_REQUEST).json({message: '用户名过长'});
    }
    
    // 检查是否有重复邮箱和用户名
    const registerInfoCheck = await Promise.allSettled([
        prisma.user.findMany({where:{user_email:email}}),
        prisma.user.findMany({where:{username:username}}),
    ]);
    
    if(registerInfoCheck[0].status === 'rejected'){
        throw new error(registerInfoCheck[0].reason);
    }
    if(registerInfoCheck[0].value.length > 0){
        return res.status(HTTP_STATUS.BAD_REQUEST).json({message: '邮箱已被注册'});
    }
    
    if(registerInfoCheck[1].status === 'rejected'){
        throw new error(registerInfoCheck[1].reason);
    }
    if(registerInfoCheck[1].value.length > 0){
        return res.status(HTTP_STATUS.BAD_REQUEST).json({message: '用户名已被注册'});
    }

    // 注册
    const user = await prisma.user.create({
        data:{
            user_email:email,
            username:username,
            password:md5(password),

        }
    })
    res.json({message: '注册成功',username:username ,token: CreateToken(user['id']), id: user['id'], permission: 0});
}
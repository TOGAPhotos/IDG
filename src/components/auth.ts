import jwt from 'jsonwebtoken'
import { Request,Response,NextFunction } from "express";
import {TokenExpireTime} from '../config.js'
import { userToken } from '../../types/user.js';

const {JWT_SECRET} = process.env

export function CreateToken(userId:number){
    return jwt.sign(
        {id: userId},
        JWT_SECRET,
        {expiresIn: TokenExpireTime}
        );
}

export async function VerifyToken(req:Request,res:Response,next:NextFunction){
    if ( !req.headers['authorization'] ) {
        req.token = null;
        next()
    }

    const token = req.headers['authorization'].split(' ')[1]
    try{
        req.token = jwt.verify(token,JWT_SECRET) as userToken;
    }catch{
        req.token = null
    }
    next()
}
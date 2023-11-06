import { Request,Response } from "express"
import { GetNotamCache } from "./cache.js"
export async function GetNotam(req:Request,res:Response){
    
   const notam = GetNotamCache();

    return res.json({
       message:'获取成功',
       id:notam.id,
       title:notam.title,
       content:notam.content
    })
 }
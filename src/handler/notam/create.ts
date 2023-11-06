import { SetNotamCache } from "./cache.js";
import prisma from "./prisma.js";

export async function CreateNotam(req,res){
    const userId = req.token.id;

    const dbResult = await prisma.notam.create({
       data:{
          create_user:userId,
          title:req.body.title,
          content:req.body.content,
       }
    })
    SetNotamCache(dbResult.id,req.body.title,req.body.content)
    return res.json({message:'创建成功'})
 }
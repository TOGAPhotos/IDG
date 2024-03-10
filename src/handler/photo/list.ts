import prisma from "./prisma.js";
import { Request,Response } from "express";

export async function GetFullList(req:Request, res:Response){

    let lastId = Number(req.query['lastId']);

    let lastIdSql = isNaN(lastId) ? '' : `AND a.id < ${lastId}`;

    const result = await prisma.$queryRawUnsafe(`
        SELECT *
        FROM accept_photo WHERE 1=1 ${lastIdSql} ORDER BY id DESC LIMIT 100;

    `);

    return res.json({message:'查询成功',data:result});
}
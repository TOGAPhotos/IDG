import prisma from "./prisma.js"

let notamCache:notam = {}
export function SetNotamCache(id:number,title:string,content:string){
    notamCache = {id,title,content}
}

export function GetNotamCache(){
    return notamCache
}

export async function RenewNotamCache(){
        const dbResult = (await prisma.$queryRawUnsafe(`SELECT * FROM notam WHERE is_delete = 0 ORDER BY id DESC LIMIT 1`))[0]
        SetNotamCache(dbResult.id,dbResult.title,dbResult.content)
}
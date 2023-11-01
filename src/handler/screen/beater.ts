import { Logger } from "../../components/loger.js";
import { GetTimeStamp } from "../../components/time.js";
import { Request,Response } from "express"
import prisma from "./prisma.js";

export async function SetQueueStatus(req:Request, res:Response) {
    const queueId = Number(req.params.id);
    
    const action = req.query['action'];
    
    if (action === 'open') {
        await prisma.upload_queue.update({
            where: {
                id: queueId,
            },
            data: {
                screening: true,
                screener: req.token.id,
                last_screen_time: GetTimeStamp(),
            }
        });
    }else{
        await prisma.upload_queue.update({
            where:{
                id:queueId,
            },
            data:{
                screening:false,
            }
        })
    }
    return res.end();
}

export async function UpdateQueueStatus() {
    const date = new Date();
    const timeStamp = date.getTime();
    // const _prisma = new PrismaClient();
    await prisma.$queryRawUnsafe(
        `UPDATE upload_queue
         SET screening = FALSE
         WHERE is_delete = FALSE
           -- AND result = 0
           AND last_screen_time IS NOT NULL
           AND ${timeStamp} - last_screen_time > 1000 * 60 * 3`
    );
    // await _prisma.$disconnect();
    Logger.info('CALL FUNCTION updateQueueStatus');
    console.log('CALL FUNCTION updateQueueStatus');
}
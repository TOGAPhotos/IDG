import {Redis} from "ioredis";
import {Request, Response} from "express"

const redis = new Redis({db: REDIS_DB.UPLOAD_QUEUE_STATUS});


export async function SetQueueStatus(req: Request, res: Response) {

    const queueId = `queue_${req.params['id']}`
    const action = req.query['action'];

    if (action === 'open') {
        const cache = await redis.get(queueId);
        if (cache === null) {
            await redis.set(queueId, req.token.id);
            await redis.expire(queueId, 60 * 5);

        } else if (Number(cache) !== (req.token.id)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({message: "其他审图员正在审核中"});
        }

    } else {
        await redis.del(queueId);

    }

    return res.end();
}

// export async function UpdateQueueStatus() {
//     const date = new Date();
//     const timeStamp = date.getTime();
//     // const _prisma = new PrismaClient();
//     await prisma.$queryRawUnsafe(
//         `UPDATE upload_queue
//          SET screening = FALSE
//          WHERE is_delete = FALSE
//            -- AND result = 0
//            AND last_screen_time IS NOT NULL
//            AND ${timeStamp} - last_screen_time > 1000 * 60 * 3`
//     );
//     // await _prisma.$disconnect();
//     Logger.info('CALL FUNCTION updateQueueStatus');
//     console.log('CALL FUNCTION updateQueueStatus');
// }
import prisma from "./prisma.js";
import {GetTimeStamp} from "../../components/time.js";
export async function updateQueueStatus() {

    const timeStamp = GetTimeStamp();

    await prisma.$queryRawUnsafe(
        `UPDATE upload_queue
         SET screening = FALSE
         WHERE is_delete = FALSE
           -- AND result = 0
           AND last_screen_time IS NOT NULL
           AND ${timeStamp} - last_screen_time > 1000 * 60 * 3`
    );

    console.log('CALL FUNCTION updateQueueStatus');
}
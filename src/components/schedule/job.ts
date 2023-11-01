import nodeSchedule from "node-schedule";
import {TimerRule_3M,TimerRule_5M} from './rule.js';
import {GetRandomPhoto,GetStatisticalData,GetPhotoList,} from '../../handler/website/info.js'

export async function StartTimer(){
    await Promise.allSettled([
    GetRandomPhoto(),
    GetStatisticalData(),
    GetPhotoList(),
    ])
    // nodeSchedule.scheduleJob(TimerRule_5M,updateQueueStatus);
    nodeSchedule.scheduleJob(TimerRule_5M,GetPhotoList);
    nodeSchedule.scheduleJob(TimerRule_3M,GetStatisticalData);
    // nodeSchedule.scheduleJob(TimerRule_5M,GetUploadQueueCursor);
    // nodeSchedule.scheduleJob(TimerRule_5M,GetExcludeList);
    nodeSchedule.scheduleJob(TimerRule_5M,GetRandomPhoto);
    // nodeSchedule.scheduleJob(TimeRule_1H,ResetEmailSendLimit);
}

import nodeSchedule from "node-schedule";
import {TimerRule_3M,TimerRule_5M,TimeRule_1H} from './rule.js';
import {GetRandomPhoto,GetStatisticalData,GetPhotoList,} from '../../handler/website/info.js'
import { GetExcludeList } from "../../handler/queue/get.js";
import { HourLimit } from "../email/send.js";
import { RenewNotamCache } from "../../handler/notam/cache.js";
import {updateQueueStatus} from "../../handler/queue/update.js";

export async function StartTimer(){
    await Promise.allSettled([
    GetRandomPhoto(),
    GetStatisticalData(),
    GetExcludeList(),
    GetPhotoList(),
    RenewNotamCache(),
    ])
    nodeSchedule.scheduleJob(TimerRule_3M,updateQueueStatus);
    nodeSchedule.scheduleJob(TimerRule_5M,GetPhotoList);
    nodeSchedule.scheduleJob(TimerRule_3M,GetStatisticalData);
    nodeSchedule.scheduleJob(TimeRule_1H,RenewNotamCache)
    nodeSchedule.scheduleJob(TimerRule_5M,GetExcludeList);
    nodeSchedule.scheduleJob(TimerRule_5M,GetRandomPhoto);
    nodeSchedule.scheduleJob(TimeRule_1H,HourLimit.reset);
}

import nodeSchedule from "node-schedule";
import {TimerRule_10M, TimerRule_3M, TimerRule_5M, TimeRule_1H} from './rule.js';
import {GetRandomPhoto, GetStatisticalData, GetPhotoList, GetVoteTopList,} from '../../handler/website/info.js'
import { GetExcludeList } from "../../handler/queue/get.js";
import { HourLimit } from "../email/send.js";
import { RenewNotamCache } from "../../handler/notam/cache.js";
import {UpdateQueueStatus} from "../../handler/queue/update.js";
import {GetVote} from "../../handler/vote/get.js";

export async function StartTimer(){
    await Promise.allSettled([
    GetRandomPhoto(),
    GetStatisticalData(),
    GetExcludeList(),
    GetPhotoList(),
    RenewNotamCache(),
    GetVoteTopList(),
    ]);

    nodeSchedule.scheduleJob(TimerRule_10M,GetVoteTopList);
    nodeSchedule.scheduleJob(TimerRule_3M,UpdateQueueStatus);
    nodeSchedule.scheduleJob(TimerRule_5M,GetPhotoList);
    nodeSchedule.scheduleJob(TimerRule_3M,GetStatisticalData);
    nodeSchedule.scheduleJob(TimeRule_1H,RenewNotamCache)
    nodeSchedule.scheduleJob(TimerRule_5M,GetExcludeList);
    nodeSchedule.scheduleJob(TimerRule_5M,GetRandomPhoto);
    nodeSchedule.scheduleJob(TimeRule_1H,HourLimit.reset);

}

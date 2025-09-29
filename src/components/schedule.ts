import nodeSchedule from "node-schedule";
import { tallySCVote } from "../handler/vote/schedule.js";
import { workerCheck } from "../components/registerService/index.js";
import { updateUserStatus } from "../handler/user/schedule.js";
import { logConnHeartbeat } from "@/components/logStream.js";

export function registerScheduleJob() {
  nodeSchedule.scheduleJob("*/1 * * * *", tallySCVote);
  nodeSchedule.scheduleJob("*/5 * * * *", workerCheck);
  nodeSchedule.scheduleJob("*/5 * * * *", updateUserStatus);
  nodeSchedule.scheduleJob("*/1 * * * *", logConnHeartbeat);
}

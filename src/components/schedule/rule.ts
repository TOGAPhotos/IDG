import nodeSchedule from "node-schedule";

const TimerRule_3M = new nodeSchedule.RecurrenceRule();
TimerRule_3M.minute = [0,3,6,9,12,15,18,21,24,27,30,33,36,39,42,45,48,51,54,57];
TimerRule_3M.second = 0;

const TimerRule_5M = new nodeSchedule.RecurrenceRule();
TimerRule_5M.minute = [0,5,10,15,20,25,30,35,40,45,50,55];
TimerRule_5M.second = 0;

const TimerRule_10M = new nodeSchedule.RecurrenceRule();
TimerRule_10M.minute = [0,10,20,30,40,50];
TimerRule_10M.second = 0;

const TimeRule_1H = new nodeSchedule.RecurrenceRule();
TimeRule_1H.hour = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23];
TimeRule_1H.minute = 0
TimeRule_1H.second = 0

export {TimerRule_3M,TimerRule_5M,TimerRule_10M,TimeRule_1H,}
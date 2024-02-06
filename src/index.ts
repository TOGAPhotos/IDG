import {SHARE_ENV, Worker} from "worker_threads";
import {Logger} from "./components/loger.js";
import bell from "./components/bell.js";
import {SendInfoReviewNoticeEmail} from "./components/email/info-mail.js";
import 'dotenv/config'

// 启动HTTP服务器
// StartHTTPServer();

await SendInfoReviewNoticeEmail(`2468910380@qq.com`,'accept','队列测试','OTHER','QUEUE');


// 启动消息队列消费者
const worker = new Worker('./dist/service/mail/index.js',{
    env:SHARE_ENV
});
worker.on('error', (err) => {
    Logger.error(err.message+'\n'+err.stack);
    console.log(err.message+'\n'+err.stack);
    return bell('邮件服务错误',err.message+'\n')
});

import {SHARE_ENV, Worker} from "worker_threads";
import Log from "./components/loger.js";
import bell from "./components/bell.js";
import StartHTTPServer from "./app.js";

import 'dotenv/config'
import ErrorHandler from "./components/errorHandler.js";

// 全局错误处理
process.on('uncaughtException', ErrorHandler.syncError);
process.on('unhandledRejection', ErrorHandler.asyncError);
process.on('exit', code => bell('TOGAPhotos API离线',"退出代码"+code))

// 启动HTTP服务器
StartHTTPServer();

// 启动消息队列消费者
const worker = new Worker(
    './dist/service/mail/index.js',
    {env:SHARE_ENV}
);

worker.on('error', err => {
    Log.error(err.message+'\n'+err.stack);
    return bell('邮件服务错误',err.message+'\n')
});

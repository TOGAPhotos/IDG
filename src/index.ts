import {SHARE_ENV, Worker} from "worker_threads";
import Log from "./components/loger.js";
import bell from "./components/bell.js";
import StartHTTPServer from "./app.js";

import 'dotenv/config'

// 启动HTTP服务器
StartHTTPServer();



// 启动消息队列消费者
const worker = new Worker('./dist/service/mail/index.js',{
    env:SHARE_ENV
});

worker.on('error', (err) => {
    Log.error(err.message+'\n'+err.stack);
    console.log(err.message+'\n'+err.stack);
    return bell('邮件服务错误',err.message+'\n')
});


import bell from "./components/bell.js";
import StartHTTPServer from "./server.js";

import 'dotenv/config'
import ErrorHandler from "./components/errorHandler.js";
import {startConsoleStr} from "./config.js";
import RegisterService from "./components/registerService/index.js";

console.log(startConsoleStr);

// 全局错误处理
process.on('uncaughtException', ErrorHandler.syncError);
process.on('unhandledRejection', ErrorHandler.asyncError);
process.on('exit', code => bell('TOGAPhotos API离线',"退出代码"+code))


// 启动HTTP服务器
StartHTTPServer();

// 启动消息队列消费者
const mailService = new RegisterService('mail', './dist/service/mail/index.js');
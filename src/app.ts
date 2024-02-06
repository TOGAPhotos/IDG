import express from "express";
import { Request,Response,NextFunction } from "express";
import cors from "cors";
import router from "./router/index.js";
import { Logger } from "./components/loger.js";
import { randomUUID } from "crypto";
import { VerifyToken} from './components/auth/token.js'
import { StartTimer } from "./components/schedule/job.js";
import bell from "./components/bell.js";
const server = express();

server.use(cors())
server.use(express.json());

server.use(VerifyToken)

server.use((req,res,next)=>{

    req.uuid = randomUUID();
    req.userIp = req.headers['x-real-ip'] as string || req.ip;

    Logger.info(`
    ${req.userIp} ${req.method} ${req.url}
    user_id:${req.token?.id} ${req.uuid}
    ${JSON.stringify(req.body)}

    `)
    next();
})

server.use('/api/v1',router);

server.use((err:Error,req:Request,res:Response,next:NextFunction)=>{
    Logger.error(`
    ${req.uuid}
    ${err.message}
    ${err.stack}

    `);
    console.log(`
    ${req.uuid}
    ${err.message}
    ${err.stack}

    `)
    return res.status(HTTP_STATUS.SERVER_ERROR).json({message:'服务器错误'})
})

export default function StartHTTPServer(){
    server.listen(3000,async()=>{
        await StartTimer();
        await bell('TOGAPhotos后端服务器',`${new Date().toString()}服务器启动`);
        Logger.info('\n\n\n\nServer Start On 3000');
        console.log('Server Start On 3000');
    });
}
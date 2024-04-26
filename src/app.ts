import express from "express";
import { Request,Response,NextFunction } from "express";
import cors from "cors";
import router from "./router/index.js";
import  Log  from "./components/loger.js";
import { randomUUID } from "crypto";
import { VerifyToken} from './components/auth/token.js'
import bell from "./components/bell.js";
import {HTTP_PORT} from "./config.js";
import WebsiteHandler from "./handler/info/website.js";

const server = express();

server.use(cors())
server.use(express.json());

server.use(VerifyToken)

server.use((req,res,next)=>{

    req.uuid = randomUUID();
    req.userIp = req.headers['x-real-ip'] as string || req.ip;

    Log.info(`
    ${req.userIp} ${req.method} ${req.url}
    userId:${req.token?.id} ${req.uuid}
    ${JSON.stringify(req.body)}
    `)
    console.log(`${req.userIp} ${req.method} ${req.url}`)
    next();
})

server.use('/api/v1',router);

server.use((err:Error,req:Request,res:Response,next:NextFunction)=>{
    Log.error(`
    ${req.uuid}
    ${err.message}
    ${err.stack}
    `);
    return res.status(HTTP_STATUS.SERVER_ERROR).json({message:err.message})
})

export default function StartHTTPServer(){
    server.listen(HTTP_PORT,async()=>{
        await WebsiteHandler.scheduleUpdate();
        // await bell('TOGAPhotos后端服务器',`${new Date().toString()}服务器启动`);
        Log.info('Server Start On 3000\n====================\n');
        console.log('Server Start On 3000');
    });
}
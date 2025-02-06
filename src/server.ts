import express from "express";
import { Request,Response,NextFunction } from "express";
import cors from "cors";
import router from "./router/index.js";
import  Log  from "./components/loger.js";
import Token from './components/auth/token.js'
import bell from "./components/bell.js";
import {CORS_WHITE_LIST, HTTP_PORT, PRODUCTION_ENV} from "./config.js";
import WebsiteHandler from "./handler/info/website.js";
import {success,fail} from './exntend/response.js'
import { HTTP_STATUS } from "./types/http_code.js";

const server = express();

if(PRODUCTION_ENV){
    server.use(cors({
        origin: CORS_WHITE_LIST
    }))
}else{
    server.use(cors())
}


server.use(express.json());

server.response.success = success;
server.response.fail = fail;

server.use(Token.verifyMW)
server.use(Log.accessLogMW());

server.use('/api/v2',router);

server.use((err:Error,req:Request,res:Response,next:NextFunction)=>{
    Log.error(`${req.uuid} ${err.message} ${err.stack}`);
    return res.fail(HTTP_STATUS.SERVER_ERROR,err.message)
})

export default function StartHTTPServer(){
    server.listen(HTTP_PORT,async()=>{
        await WebsiteHandler.scheduleUpdate();
        // await bell('TOGAPhotos后端服务器',`${new Date().toString()}服务器启动`);
        Log.info('HTTP Server Start On localhost:3000');
    });
}
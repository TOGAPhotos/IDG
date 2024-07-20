import {SHARE_ENV, Worker} from "worker_threads";

import Log from "../loger.js";
import bell from "../bell.js";

export default class RegisterService{
    public worker:Worker;

    constructor(name:string,scriptPath:string,options?: WorkerOptions){
        this.worker = new Worker(
            scriptPath,
            options
        );
        
        this.worker.on('online',()=> Log.info(name+'service online'));

        this.worker.on('error', err => {
            Log.error(err.message+'\n'+err.stack);
            return bell(name+'service error',err.message+'\n')
        });
    }
}
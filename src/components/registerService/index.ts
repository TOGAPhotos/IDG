import {SHARE_ENV, Worker} from "worker_threads";

import Log from "../loger.js";
import bell from "../bell.js";
import { WORKER_REPORT_INTERVAL } from "../../config.js";

type WorkerStatus = 'online'|'offline'|'error';

setInterval(()=>{
    const offlineList = RegisterService.getService('offline');
    const onlineList = RegisterService.getService('online');

    if(offlineList.length === 0){
        Log.success(`All ${onlineList.length} service(s) online`);
    }else{
        Log.error('Offline service:'+offlineList.join(','));
    }

},WORKER_REPORT_INTERVAL);

export default class RegisterService{

    private static nameList:string[] = [];
    private static statusMap:Map<string,WorkerStatus> = new Map();
    private static serviceMap:Map<string,Worker> = new Map();

    public worker:Worker;
    private name:string;

    static getService(status:WorkerStatus = 'online'){
        return Array.from(RegisterService.statusMap)
            .filter(([name,stat])=>stat===status)
            .map(([name])=>name);
    }

    private static async updateServiceStatus(name,status:WorkerStatus){
        RegisterService.statusMap.set(name,status);
        if(status==='error'){
            await bell(`${name} service error`);
        }
    }

    constructor(name:string,scriptPath:string,options?: WorkerOptions){
        this.name = name;
        if(RegisterService.nameList.includes(name)){
            Log.error('Service name repeat');
            throw new Error('Service name repeat');
        }

        RegisterService.nameList.push(name);
        RegisterService.statusMap.set(name,'offline');

        this.worker = new Worker(
            scriptPath,
            options
        );

        RegisterService.serviceMap.set(name,this.worker);

        this.worker.on('online',()=> {
            RegisterService.updateServiceStatus(this.name,'online');
            Log.success(`${this.name} Worker online`);
        });

        this.worker.on('error', err => {
            RegisterService.updateServiceStatus(this.name,'error');
            Log.error(`${this.name} Worker error:${err.message}`);
        });

    }

    getStatus(){
        return RegisterService.statusMap.get(this.name);
    }
}
import {Worker, WorkerOptions} from "worker_threads";
import {ThreadErrorCallback} from "./type.js";

export default class ThreadWorker{
    public readonly name:string;
    private readonly file:string;
    private thread:Worker|null = null;
    constructor(name:string,file:string,options?:WorkerOptions){
        this.name = name;
        this.file = file
        this.thread = new Worker(this.file,options);
    }

    public setErrorCallback(callback:ThreadErrorCallback) {
        this.thread.on('error', callback)
    }

    public getThread():Worker|null{
        return this.thread;
    }

    public async send(data:any){
        if(this.thread === null){
            throw new Error(`线程未初始化`)
        }
        this.thread.postMessage(data);
    }



}
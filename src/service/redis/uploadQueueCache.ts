import {Redis} from "ioredis";
import {checkNumberParams} from "../../components/decorators/checkNumberParams.js"
import {REDIS_DB} from "./distribute.js";

export class UploadQueueCache {
    private conn: Redis;
    constructor() {
        this.conn = new Redis({db: REDIS_DB.UPLOAD_QUEUE_STATUS});
    }

    private genKey(queueId:number){
        return `queue_${queueId}`
    }

    async get(queueId:number){
        return this.conn.get( this.genKey(queueId) )
    }
 
    async set(queueId:number,screenerId:number){
        const key = this.genKey(queueId)
        this.conn.set(key,screenerId)
        this.conn.expire(key,60*5)
    }
 
    async update(queueId:number,screenerId:number):Promise<boolean>{
        const key = this.genKey(queueId)
        const cacheInfo = await this.conn.get(key)
        if( Number(cacheInfo) === screenerId){
            this.conn.set(key,screenerId)
            this.conn.expire(key,60*5)
            return true
        }else{
            return false
        }
    }
 
    async del(queueId:number){
        this.conn.del( this.genKey(queueId) )
    }
}
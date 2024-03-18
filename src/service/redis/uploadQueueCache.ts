import {Redis} from "ioredis";
import {checkNumberParams} from "../../components/decorators/checkNumberParams.js"
import {REDIS_DB} from "./distribute.js";

export class UploadQueueCache {
    private conn: Redis;
    constructor() {
        this.conn = new Redis({db: REDIS_DB.UPLOAD_QUEUE_STATUS});
    }

    @checkNumberParams
    async get(queueId:number){
        return this.conn.get(`queue_${queueId}`)
    }

    @checkNumberParams
    async set(queueId:number,screenerId:number){
        const key = `queue_${queueId}`
        this.conn.set(key,screenerId)
        this.conn.expire(key,60*5)
    }

    @checkNumberParams
    async update(queueId:number,screenerId:number){
        const key = `queue_${queueId}`

        const cacheInfo = await this.conn.get(key)
        if(cacheInfo === null){
            await this.set(queueId,screenerId)
        }
        if(Number(cacheInfo) !== screenerId){
            throw new Error("其他审图员正在审核中")
        }
    }

    @checkNumberParams
    async del(queueId:number){
        const key = `queue_${queueId}`
        this.conn.del(key)
    }
}
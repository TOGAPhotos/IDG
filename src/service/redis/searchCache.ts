import {Redis} from "ioredis";

export default class SearchCache {
    private conn: Redis;
    constructor(dbId:number){
        this.conn = new Redis({db: dbId});
    }

    async set(keyword:string,result:any){
        const key = `${keyword}`
        this.conn.set(key,JSON.stringify(result))
        this.conn.expire(key,60*5)
    }

    async get(keyword:string){
        const key = `${keyword}`
        const result = await this.conn.get(key)
        if(result === null){
            return null
        }
        return JSON.parse(result)
    }

    async flush(){
        this.conn.flushdb()
    }
}
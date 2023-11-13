import { Logger } from "./loger.js"

export function CheckPromiseResult(PromiseArray:PromiseSettledResult<any>[]):any[]{
    
    return PromiseArray.map(result => {
        if(result.status === 'rejected'){
            Logger.error(result.reason)
            throw new Error(result.reason)
        }
        return result.value
    })

}
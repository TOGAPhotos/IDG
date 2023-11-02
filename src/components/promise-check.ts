import { Logger } from "./loger.js"

export function CheckPromisResult(PromisArry:PromiseSettledResult<any>[]):any[]{
    
    return PromisArry.map(result => {
        if(result.status === 'rejected'){
            Logger.error(result.reason)
            throw new Error(result.reason)
        }
        return result.value
    })
}
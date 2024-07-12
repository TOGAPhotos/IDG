export function success(msg:any):void;
export function success(msg:string,data: any):void
export function success(...args:any[]):void{

    if (args.length === 2){
        const [msg,data] = args
        return this.status(200).json({msg:msg,data:data});

    }else if (args.length === 1){
        const [msg] = args
        return this.status(200).json({msg:msg});
    }

    throw new Error('Response Success Function Param Missing');

}

export function fail(statusCode:number,msg:string):void;
export function fail(statusCode:number,msg:string,data:any):void;
export function fail(...args:any[]):void{
    if (args.length === 3){
        const [statusCode,msg,data] = args
        return this.status(statusCode).json({msg:msg,data:data});
    }else if (args.length === 2){
        const [statusCode,msg] = args
        return this.status(statusCode).json({msg:msg});
    }
}

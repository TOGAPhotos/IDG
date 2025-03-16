declare namespace Express {
    export interface Request {
        userIp?:string,
        uuid?:string
        token?: { id:number } | null,
        role?: string,
        tId:string,
    }

    export interface Response {
        success:{
            // ():void;
            (msg:any):void;
            (msg:string,data: any):void
        };
        fail:{
            (statusCode:number):void
            (statusCode:number,msg:string):void;
            (statusCode:number,msg:string,data:any):void
        };
    }
}



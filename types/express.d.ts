declare namespace Express {
    export interface Request {
        userIp?:string,
        uuid?:string
        token?: { id:number } | null,
        role?: string
    }
}



declare namespace Express {
    export interface Request {
        ip?:string,
        uuid?:string
        token?: { id:number } | null,
    }
}



import jwt from 'jsonwebtoken'
import { Request, Response, NextFunction } from "express";
import { TOKEN_EXPIRE_TIME } from '../../config.js'

const { JWT_SECRET } = process.env

export default class Token {
    static create(userId: number) {
        return jwt.sign(
            { id: userId },
            JWT_SECRET,
            { expiresIn: TOKEN_EXPIRE_TIME }
        );
    }

    static verifyMW(req: Request, res: Response, next: NextFunction) {
        try {
            const token = req.headers['authorization'].split(' ')[1]
            req.token = jwt.verify(token, JWT_SECRET) as { id: number }
        } catch {
            req.token = null
        }
        next()
    }
}

// export function CreateToken(userId: number) {
//     return jwt.sign(
//         { id: userId },
//         JWT_SECRET,
//         { expiresIn: TOKEN_EXPIRE_TIME }
//     );
// }

export async function VerifyToken(req: Request, res: Response, next: NextFunction) {
    try {
        const token = req.headers['authorization'].split(' ')[1]
        req.token = jwt.verify(token, JWT_SECRET) as { id: number }
    } catch {
        req.token = null
    }
    next()
}

import {PrismaClient} from '@prisma/client';

const prisma = new PrismaClient();

export interface UserData {
    id: number,
    user_email: string,
    username: string
    password: string
    role: string,
    passing_rate: number,
    total_queue: number,
    free_queue: number,
    priority_queue: number,
    free_priority_queue: number,
    total_photo: number,
    create_time: Date,
    update_time: Date
    status: string,
    suspension_days: number,
    email_verify: boolean,
    email_verify_token: string,
    is_deleted: boolean
}

export class User {
    static async getUserById(id: number) {
        return prisma.user.findUnique({where: {id: id}});
    }
}
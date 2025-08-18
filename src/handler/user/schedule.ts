import { PrismaClient } from "@prisma/client";
import Log from "../../components/loger.js";
const prisma = new PrismaClient();

export async function updateUserStatus(){
  await prisma.user.updateMany({
    where:{
      suspension_date: {lt: Date.now()},
      status: {not:"NORMAL"},
      is_deleted: false
    },
    data:{
      status: "NORMAL",
      suspension_date: null
    }
  })
}
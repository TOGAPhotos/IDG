import sharedPrisma from "../../lib/prisma.js";
import Log from "../../components/loger.js";
const prisma = sharedPrisma;

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
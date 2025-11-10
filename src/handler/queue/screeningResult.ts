import MailTemp from "../../service/mail/mailTemp.js";
import { PrismaClient } from "@prisma/client";
import User from "../../dto/user.js";
import Log from "../../components/loger.js"

export async function ScreeningResultNotice(){
  const prisma = new PrismaClient();
  const list = await prisma.full_photo_info.findMany({
    select:{
      id:true,
      upload_user_id:true,
      ac_reg:true,
      airline_cn:true,
      airline_en:true,
      result:true,
      reason:true,
    },
    where: {
      OR:[
        { status:'ACCEPT'},
        { status:'REJECT' }
      ],
      notify: false,
    }
  });
  const userPhotoMap: Map<number, {id: number; ac_reg: string; airline: string; status: string,reason:string}[]> = new Map();
  for(const photo of list){
    if(!userPhotoMap.has(photo.upload_user_id)){
      userPhotoMap.set(photo.upload_user_id, []);
    }
    userPhotoMap.get(photo.upload_user_id)!.push({
      id: photo.id,
      ac_reg: photo.ac_reg,
      airline: photo.airline_cn || photo.airline_en || "未知",
      status: photo.result,
      reason: photo.reason,
    });
  }
  const groupQuery = await Promise.allSettled(
    [...userPhotoMap.keys()].map((userId) => User.getById(userId))
  );

  const notifiedList:number[] = []
  const groupSend = groupQuery.map(
    async (r) => {
      if (r.status === "rejected") return;
      const user = r.value;
      const photoList = userPhotoMap.get(user.id)!;
      try{
        await MailTemp.ScreeningResultNotice(
          // user.user_email,
          'davidyan003@gmail.com',
          {
            username: user.username,
            photoList: photoList,
          }
        )
        notifiedList.push(...photoList.map(p => p.id));
      }catch(e){
          Log.error(`Fail on sending screening result email to user ${user.id}: ${e}`);
      }
    }
  )
  await Promise.allSettled(groupSend);

  await prisma.photo.updateMany({
    where:{
      notify: false,
      id:{ in: notifiedList }
    },
    data:{
      notify:true,
    }
  })

}
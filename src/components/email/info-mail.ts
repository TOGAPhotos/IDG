import { SendEmail } from "./send.js";
export async function SendInfoReviewNoticeEmail(emailAddr:string,result:string,cn_name:string,icao:string,iata='—'){
    if (iata === null){
        iata = '-';
    }
    if (iata.length === 0){
        iata = '—'
    }
    return SendEmail(
        "TO/GA PHOTOS 数据管理团队 <DataManagementTeam@togaphotos.com>",
        emailAddr,
        '[TO/GA Photos] 数据库补充信息审核结果',
        `toga_photos_add_info_${result}`,
        {cn_name:cn_name,iata:iata,icao:icao}
        );
}


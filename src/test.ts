import { PRODUCTION_ENV } from "./config.js";

if(PRODUCTION_ENV){
  console.error("This test script can only be run in a non-production environment.");
  process.exit(0);
}

import MailTemp from "@/service/mail/mailTemp.js";
import RegisterService from "@/components/registerService/index.js";
const mailService = new RegisterService("mail", "./dist/service/mail/index.js");
await MailTemp.ScreeningResultNotice(
  "test@togaphotos.com",
  {
    username: "TEST_USER",
    photoList: [
      {
        id: 123,
        ac_reg: "B-1806",
        airline: "中国国际航空",
        status: "accept",
        reason: "",
      },
      {
      id: 1234,
      ac_reg: "B-2032",
      airline: "中国国际航空",
      status: "accept",
      reason: "",
    },
    {
      id: 12345,
      ac_reg: "B-6091",
      airline: "中国国际航空",
      status: "reject",
      reason: "模糊、过度处理",
    }
    ]
  }
)

// RegisterService.stopAll()

// console.log("RegisterService stopped.");
console.log("Test script completed.");
// process.exit(0);
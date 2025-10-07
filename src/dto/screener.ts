import { PrismaClient } from "@prisma/client";
import { safeSQL } from "../components/decorators/safeSQL.js";
type CountResult = {"COUNT(id)":number}[]
export class Screener {
  private static prisma = new PrismaClient();

  @safeSQL
  public static async getScreeningStatistics(userId:number|string){
    const [Carrier,Month,Day] = await Promise.all([
      Screener.prisma.$queryRawUnsafe(`
      SELECT COUNT(id)
      FROM photo
      WHERE
      (status = 'ACCEPT' OR status = 'REJECT')
      AND is_delete = FALSE
      AND( screener_1 = ${userId} OR screener_2 = ${userId})
    `) as unknown as CountResult,
      Screener.prisma.$queryRawUnsafe(`
      SELECT COUNT(id)
      FROM photo
      WHERE
      (status = 'ACCEPT' OR status = 'REJECT')
      AND screen_finished_time is NOT NULL
      AND is_delete = FALSE
      AND( screener_1 = ${userId} OR screener_2 = ${userId})
      AND screen_finished_time >= CURDATE() - INTERVAL 1 MONTH
    `) as unknown as CountResult,
      Screener.prisma.$queryRawUnsafe(`
      SELECT COUNT(id)
      FROM photo
      WHERE
      (status = 'ACCEPT' OR status = 'REJECT')
      AND screen_finished_time is NOT NULL
      AND is_delete = FALSE
      AND( screener_1 = ${userId} OR screener_2 = ${userId})
      AND screen_finished_time >= CURDATE() - INTERVAL 1 DAY
    `) as unknown as CountResult
    ])
    return {
      Carrier: Carrier[0]['COUNT(id)'],
      Month: Month[0]['COUNT(id)'],
      Day: Day[0]['COUNT(id)']
    }
  }
}
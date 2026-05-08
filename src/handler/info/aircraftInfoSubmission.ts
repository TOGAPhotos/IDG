import type { Request, Response } from "express";
import Permission from "../../components/auth/permissions.js";
import User from "../../dto/user.js";
import AircraftInfoSubmission from "../../dto/aircraftInfoSubmission.js";
import { HTTP_STATUS } from "../../types/http_code.js";

export default class AircraftInfoSubmissionHandler {
  static async create(req: Request, res: Response) {
    try {
      const submission = await AircraftInfoSubmission.create(req.token.id, req.body);
      return res.success("提交成功", { submission });
    } catch (e) {
      return res.fail(HTTP_STATUS.BAD_REQUEST, (e as Error).message);
    }
  }

  static async list(req: Request, res: Response) {
    const user = await User.getById(req.token.id);
    const status = String(req.query.status || "WAITING").toUpperCase();
    const submissions = await AircraftInfoSubmission.list(
      status,
      Permission.isStaff(user.role) ? undefined : req.token.id,
    );
    return res.success("查询成功", { submissions });
  }

  static async review(req: Request, res: Response) {
    const id = Number(req.params.id);
    const status = String(req.body?.status || req.query.status || "").toUpperCase();
    if (!Number.isFinite(id)) {
      return res.fail(HTTP_STATUS.BAD_REQUEST, "提交ID无效");
    }
    if (status !== "AVAILABLE" && status !== "REJECT") {
      return res.fail(HTTP_STATUS.BAD_REQUEST, "审核结果无效");
    }
    const submission = await AircraftInfoSubmission.review(
      id,
      req.token.id,
      status,
      req.body?.message,
    );
    if (!submission) {
      return res.fail(HTTP_STATUS.NOT_FOUND, "提交不存在");
    }
    return res.success("审核完成", { submission });
  }
}

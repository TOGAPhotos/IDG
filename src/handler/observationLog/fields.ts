import type { Request, Response } from "express";
import { HTTP_STATUS } from "../../types/http_code.js";
import ObservationLog from "../../dto/observationLog.js";

export default class ObservationLogFieldHandler {
  static async list(req: Request, res: Response) {
    const fields = await ObservationLog.listFields(
      req.token.id,
      req.query.includeArchived === "1",
    );
    return res.success("查询成功", { fields });
  }

  static async create(req: Request, res: Response) {
    try {
      const field = await ObservationLog.createField(req.token.id, req.body);
      return res.success("创建成功", { field });
    } catch (e) {
      return res.fail(HTTP_STATUS.BAD_REQUEST, (e as Error).message);
    }
  }

  static async update(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.fail(HTTP_STATUS.BAD_REQUEST, "字段ID无效");
    }
    const field = await ObservationLog.updateField(req.token.id, id, req.body);
    if (!field) {
      return res.fail(HTTP_STATUS.NOT_FOUND, "字段不存在");
    }
    return res.success("更新成功", { field });
  }

  static async delete(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.fail(HTTP_STATUS.BAD_REQUEST, "字段ID无效");
    }
    await ObservationLog.archiveField(req.token.id, id);
    return res.success("删除成功");
  }
}

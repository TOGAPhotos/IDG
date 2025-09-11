import { Router } from "express";

import Per from "../components/auth/permissions.js";
import ServexHandler from "@/handler/servex/index.js";

const servexRouter = Router();
servexRouter.use(Per.isLoginMW);
servexRouter.get("/cdn/rawPhoto/:id",ServexHandler.accessRawPhoto);
servexRouter.get("/cdn/sign", Per.isStaffMW, ServexHandler.sign);

export default servexRouter;
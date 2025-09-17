import { Router } from "express";

import Per from "../components/auth/permissions.js";
import ServexHandler from "../handler/servex/index.js";

const servexRouter = Router();
servexRouter.get("/cdn/sign/:key", ServexHandler.sign);
servexRouter.get("/cdn/rawPhoto/:key/:id",ServexHandler.uploaderAccessRawPhoto);
servexRouter.get("/cdn/preSign",Per.isLoginMW, ServexHandler.preSign);

export default servexRouter;
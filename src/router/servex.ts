import { Router } from "express";

import Per from "../components/auth/permissions.js";
import CDNHandler from "@/handler/cdn/index.js";

const servexRouter = Router();
servexRouter.use(Per.isLoginMW);
servexRouter.get("/cdn/sign",CDNHandler.sign);

export default servexRouter;
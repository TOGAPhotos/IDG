import { Router } from "express";

import Per from "../components/auth/permissions.js";
import VoteHandler from "../handler/vote/index.js";

const voteSysRouter = Router();

voteSysRouter.use(Per.isLoginMW);

voteSysRouter.get("/screenerChoices", Per.isScreenerMW, VoteHandler.getSCVoteList);
voteSysRouter.get("/screenerChoice/:id", Per.isScreenerMW, VoteHandler.getSCVote);
voteSysRouter.post("/screenerChoice", Per.isScreenerMW, VoteHandler.createSCVote);
voteSysRouter.put("/screenerChoice/:id", Per.isScreenerMW, VoteHandler.SCVote);

voteSysRouter.delete("/screenerChoice/:id", Per.isScreenerMW, VoteHandler.deleteVote);
export default voteSysRouter;

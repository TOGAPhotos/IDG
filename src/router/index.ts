import { Router } from "express";
import { Login } from "../handler/user/login.js";
import { register } from "module";
import { Register } from "../handler/user/register.js";

const router = Router();

router.post("/login",Login)
router.post("/register",Register)



export default router;
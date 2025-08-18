import User from "../../dto/user.js";
import { Request, Response } from "express";
import { md5 } from "../../components/crypto.js";
import { TOKEN_EXPIRE_TIME } from "../../config.js";
import Token from "../../components/auth/token.js";
import Time from "../../components/time.js";
import Permission from "../../components/auth/permissions.js";
import Photo from "../../dto/photo.js";
import { HTTP_STATUS } from "../../types/http_code.js";
import * as z from "zod/mini";
import Log from "../../components/loger.js";

export default class UserHandler {
  static async login(req: Request, res: Response) {
    let { email, password }: { email: string; password: string } = req.body;
    const userList = await User.getByEmail(email);
    if (userList.length === 0) {
      return res.fail(HTTP_STATUS.NOT_FOUND, "账户不存在");
    }

    const userInfo = userList[0];

    if (userInfo.password !== md5(password)) {
      return res.fail(HTTP_STATUS.UNAUTHORIZED, "密码错误");
    }
    if (Permission.checkUserStatus(userInfo) === false) {
      return res.fail(HTTP_STATUS.UNAUTHORIZED, "用户状态异常");
    }

    return res.success("登录成功", {
      token: Token.create(userInfo.id),
      expireTime: Time.getTimeStamp() + TOKEN_EXPIRE_TIME * 1000,
      id: userInfo.id,
      username: userInfo.username,
      permission: userInfo.role,
    });
  }

  private static safeUserInfo(userInfo: any) {
    delete userInfo.password;
    return userInfo;
  }

  private static delPrivateInfo(userInfo: any) {
    delete userInfo.user_email;
    delete userInfo.pass_rate;
  }

  static async register(req: Request, res: Response) {
    let {
      email,
      username,
      password,
      passwordR,
    }: {
      email: string;
      username: string;
      password: string;
      passwordR: string;
    } = req.body;

    // 基础检查
    if (!z.email().safeParse(email).success) {
      return res.fail(HTTP_STATUS.BAD_REQUEST, "邮箱格式错误");
    }
    // if(password !== passwordR){
    //     return res.fail(HTTP_STATUS.BAD_REQUEST,'两次密码不一致');
    // }
    if (username.length > 20) {
      return res.fail(HTTP_STATUS.BAD_REQUEST, "用户名过长");
    }

    const emailCheck = await User.getByEmail(email);
    if (emailCheck.length > 0) {
      return res.fail(HTTP_STATUS.BAD_REQUEST, "邮箱已被注册");
    }
    const usernameCheck = await User.getByUsername(username);
    if (usernameCheck.length > 0) {
      return res.fail(HTTP_STATUS.BAD_REQUEST, "用户名已被注册");
    }

    const user = await User.create(email, username, md5(password));

    return res.success("注册成功", {
      username: username,
      token: Token.create(user["id"]),
      id: user["id"],
      permission: Permission.user,
      expireTime: Time.getTimeStamp() + TOKEN_EXPIRE_TIME * 1000,
    });
  }

  static async delete(req: Request, res: Response) {
    await User.delete(Number(req.params["id"]));
    return res.success("删除成功");
  }

  static async update(req: Request, res: Response) {
    const id = Number(req.params["id"]);
    const [actionUser, updateUser] = await Promise.all([
      User.getById(req.token.id),
      User.getById(id),
    ]);

    const data = req.body;

    if( !Permission.isAdmin(actionUser.role) ){
      if (id !== req.token.id) {
        return res.fail(HTTP_STATUS.UNAUTHORIZED, "没有权限");
      }
      const updateKeys = Object.keys(data)
      const allowedKeys = ["username", "allow_third_use", "allow_toga_use", "airport_id", "cover_photo_id"];
      for (let key of updateKeys) {
        if (!allowedKeys.includes(key)) {
          Log.error(`用户 ${id} 尝试更新不允许的字段: ${key}`);
          return res.fail(HTTP_STATUS.BAD_REQUEST, `不允许更新字段: ${key}`);
        }
      }
    }

    if (data["username"] && updateUser.username !== data["username"]) {
      const usernameCheck = await User.getByUsername(data["username"]);

      if (usernameCheck.length > 0) {
        for (let u of usernameCheck) {
          if (u.username !== data["username"]) continue;
          return res.fail(HTTP_STATUS.BAD_REQUEST, "用户名已注册");
        }
      }
    }

    await User.updateById(id, data);
    return res.success("更新成功");
  }

  static async search(req: Request, res: Response) {
    let { search } = req.query;
    const userList = await User.search(<string>search);
    userList.forEach((info) => UserHandler.safeUserInfo(info));
    return res.success("查询成功", userList);
  }

  static async getUserInfo(req: Request, res: Response) {
    if (req.query["search"]) {
      return await UserHandler.search(req, res);
    }
    const userId = Number(req.params["id"]);
    let userInfo = await User.getById(userId);
    if (!userInfo || userInfo.is_deleted) {
      return res.fail(HTTP_STATUS.NOT_FOUND, "用户不存在");
    }
    userInfo = UserHandler.safeUserInfo(userInfo);

    if (req.query["type"] === "safe") {
      if (!Permission.isSeniorScreener(userInfo.role)) {
        return res.fail(HTTP_STATUS.UNAUTHORIZED);
      }
      return res.success("查询成功", userInfo);
    }

    UserHandler.delPrivateInfo(userInfo);

    switch (req.query["type"]) {
      case "info":
        return res.success("查询成功", userInfo);
      case "username":
        return res.success("查询成功", { username: userInfo.username });
      default:
        const photoList = await Photo.getByUserId(userId);
        return res.success("查询成功", {
          userInfo: userInfo,
          photoList: photoList,
        });
    }
  }

  static async getUserList(req: Request, res: Response) {
    const limit = Number(req.query["limit"]) || 200;
    const offset = Number(req.query["offset"]) || 0;
    if (req.query["search"]){
      return UserHandler.search(req, res);
    }
    const list = await User.getList(offset, limit);
    list.forEach((info) => UserHandler.safeUserInfo(info));
    return res.success("查询成功", list);
  }
}

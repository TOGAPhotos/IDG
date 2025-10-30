import { md5 } from "../src/components/crypto.js";
import { stdin as input, stdout as output } from "node:process";
import readline from "node:readline";
import User from "../src/dto/user.js";


function nonFlagArgs() {
  return process.argv.slice(2).filter((a) => !a.startsWith("-"));
}

function firstArg(): string | undefined {
  const args = nonFlagArgs();
  return args[0];
}

function secondArg(): string | undefined {
  const args = nonFlagArgs();
  return args[1];
}

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input, output });
  return await new Promise<string>((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  // Warn if the salt key is missing so admin knows impact on hash
  if (!process.env.PASSWORD_CRYPT_KEY) {
    console.error(
      "Warning: PASSWORD_CRYPT_KEY is not set. The password hash will include the literal 'undefined' suffix. Set PASSWORD_CRYPT_KEY in .env for salted hashes."
    );
  }

  // 1) Ask for email (or take from argv)
  let email = firstArg();
  if (!email) {
    email = await prompt("请输入邮箱: ");
  }
  email = email.trim();
  if (!email) {
    console.error("错误: 邮箱不能为空。");
    process.exitCode = 1;
    return;
  }

  // 2) Check if user exists
  const users = await User.getByEmail(email);
  if (!users || users.length === 0) {
    console.error("错误: 用户不存在。");
    process.exitCode = 1;
    return;
  }
  if (users.length > 1) {
    console.error("错误: 存在多个相同邮箱的用户，无法继续。");
    process.exitCode = 1;
    return;
  }
  const target = users[0] as unknown as { id: number; username: string | null; user_email: string | null };

  console.warn(`警告: 你正在为用户(ID: ${target.id}, 邮箱: ${target.user_email ?? email}, 用户名: ${target.username ?? ""}) 重置密码。`);

  // 3) Ask for new password (or take from argv)
  let password = secondArg();
  if (!password) {
    password = await prompt("请输入新密码: ");
  }
  password = password.trim();
  if (!password) {
    console.error("错误: 密码不能为空。");
    process.exitCode = 1;
    return;
  }

  // 4) Hash and update
  const hashed = md5(password);
  await User.updateById(target.id, { password: hashed });

  console.log(
    `成功: 已更新用户(ID: ${target.id}, 邮箱: ${target.user_email ?? email}, 用户名: ${target.username ?? ""}) 的密码。`
  );
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exitCode = 1;
});

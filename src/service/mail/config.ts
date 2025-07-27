import "dotenv/config";
export const EMAIL_HOUR_LIMIT = 100;

export const EMAIL_DOMAIN = "togaphotos.com";

export const MailGunConnParams = {
  username: "api",
  key: process.env.MAILGUN_KEY,
  url: "https://api.mailgun.net",
};

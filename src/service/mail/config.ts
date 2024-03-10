import {getEnvironmentData} from "worker_threads";

export const EMAIL_HOUR_LIMIT = 100;

export const EMAIL_DOMAIN = 'togaphotos.com'

export const MailGunConnParams = {
    username: 'api',
    key: getEnvironmentData('MAILGUN_API_KEY'),
    url: 'https://api.mailgun.net'
}

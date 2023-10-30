import crypto from 'crypto';
export function md5(password:string):string{
    const hash = crypto.createHash('md5');
    return hash.update(password + process.env.PASSWORD_CRYPT_KEY).digest('hex');
}
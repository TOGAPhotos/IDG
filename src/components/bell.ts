const bellUrl = process.env.BELL_URL;
import { Logger } from './loger.js';

async function bell(title:string,message=""){
    Logger.info(`
    Bell
    ${title}
    ${message}
    `);

    try{
        await fetch(bellUrl,{
            method:'POST',
            headers:{'Content-type':'application/json'},
            body:JSON.stringify({title:title, desp:message})
        });
    }catch(e){
        Logger.error(`
        Bell Error
        ${e.message}
        `)
        console.error(`Bell Error:${e.message}`)
    }
}
export default bell;
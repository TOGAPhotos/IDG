import {BELL_URL} from "../config.js";
import Log from './loger.js';

export default async function bell(title:string,message=""){
    try{
        await fetch(BELL_URL,{
            method:'POST',
            headers:{'Content-type':'application/json'},
            body:JSON.stringify({title:title, desp:message})
        });
        Log.info(`Bell ${title}:${message}`);
    }catch(e){
        Log.error(`Bell Error ${e.message} unsend message:${JSON.stringify({title:title, desp:message})}`)
    }
}

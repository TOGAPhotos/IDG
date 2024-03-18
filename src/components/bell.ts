import {BELL_URL} from "../config.js";
import Log from './loger.js';

export default async function bell(title:string,message=""){
    Log.info(`Bell ${title}\n${message}`);

    try{
        await fetch(BELL_URL,{
            method:'POST',
            headers:{'Content-type':'application/json'},
            body:JSON.stringify({title:title, desp:message})
        });
    }catch(e){
        Log.error(`Bell Error ${e.message}`)
        console.error(`Bell Error:${e.message}`)
    }
}

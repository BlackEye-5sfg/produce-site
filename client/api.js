import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core';
import {createAccountSession} from './account-session';
export const native = Capacitor.isNativePlatform();
const BASE = __PLU_API_BASE__,secureSession=registerPlugin('SecureSession');
let csrf=null;
const listeners=new Set();
export const onAccountChange=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
export const MOBILE = /Android|iPhone|iPad|iPod|Mobile|IEMobile|Windows Phone|Opera Mini|webOS|Silk|Kindle/i;
export const mobileBrowser = !native && MOBILE.test(navigator.userAgent);
export const adminPath = native ? '/api/app/items' : '/api/items';
export const auditPath = native ? '/api/app/audit' : '/api/audit';
export const floorPath=native?'/api/app/floor-list':'/api/floor-list';
async function send(path,{method='GET',data}={},token){
 const headers={Accept:'application/json'};if(data!==undefined)headers['Content-Type']='application/json';
 if(native&&token)headers.Authorization=`Bearer ${token}`;if(!native&&csrf)headers['X-CSRF-Token']=csrf;
 let status,body;
 if(native){const r=await CapacitorHttp.request({url:BASE+path,method,headers,data,connectTimeout:10000,readTimeout:15000});status=r.status;try{body=typeof r.data==='string'?JSON.parse(r.data):r.data;}catch{body={};}}
 else{const r=await fetch(path,{method,headers,credentials:'same-origin',body:data===undefined?undefined:JSON.stringify(data),cache:'no-store'});status=r.status;body=await r.json().catch(()=>({}));}
 if(status<200||status>=300){const e=new Error(body.error||`Request failed (${status})`);e.status=status;e.details=body.errors;throw e;}
 if(body.csrf)csrf=body.csrf;return body;
}
const account=createAccountSession({native,storage:secureSession,send,onChange:state=>{if(!state.authenticated)csrf=null;for(const fn of listeners)fn(state);}});
export const request=(path,options)=>account.request(path,options);
export const me=()=>account.me();
export const login=(username,password)=>account.login(username,password);
export const logout=()=>account.logout();
export const cancelLogin=()=>account.cancel();
// No password/token/list localStorage. Only native encrypted session storage.
export const mediaURL=path=>/^\/photos\/[a-f0-9]{64}\.(jpg|png)$/.test(path||'')?(native?BASE:'')+path:'';

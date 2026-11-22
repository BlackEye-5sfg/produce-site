import {registerPlugin} from '@capacitor/core';
import {native} from './api';
const ScreenAwake=registerPlugin('ScreenAwake');let wake=null,wanted=false,queue=Promise.resolve();
export function screenAwake(enabled){
 wanted=enabled;
 queue=queue.catch(()=>{}).then(async()=>{
  if(native){await(wanted?ScreenAwake.keepAwake():ScreenAwake.allowSleep());if(!wanted)await ScreenAwake.allowSleep();return wanted;}
  if(!wanted){if(wake)await wake.release();wake=null;return false;}
  if(!navigator.wakeLock)throw Error('Screen-awake is not supported in this browser.');
  const lock=await navigator.wakeLock.request('screen');if(!wanted){await lock.release();return false;}wake=lock;return true;
 });return queue;
}
export function similarItems(item,items){
 const stop=new Set(['organic','conventional','small','large','medium','red','green','yellow','fresh','loose','bunched','seedless','mini','normal']);
 const words=i=>new Set(window.PLUSearch.normalize(i.name).split(' ').filter(x=>x.length>2&&!stop.has(x)));
 const a=words(item);
 return items.filter(x=>x.id!==item.id&&x.cat===item.cat).map(x=>{const b=words(x);const common=[...a].filter(w=>b.has(w)).length;return{x,score:common/Math.max(1,Math.min(a.size,b.size))};}).filter(x=>x.score>=.5).sort((a,b)=>b.score-a.score||a.x.name.localeCompare(b.x.name)).slice(0,5).map(x=>x.x);
}
export async function resizedPhoto(file){
 if(!file||!file.type.startsWith('image/')||file.size>15*1024*1024)throw Error('Choose an image under15MB.');
 const image=await createImageBitmap(file);const scale=Math.min(1,1200/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);image.close();
 let blob;for(const quality of [.85,.65,.45]){blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg',quality));if(blob&&blob.size<=512*1024)break;}
 if(!blob||blob.size>512*1024)throw Error('Photo is too detailed; choose a smaller image.');
 return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Could not read photo.'));reader.readAsDataURL(blob);});
}

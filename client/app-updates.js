import {registerPlugin} from '@capacitor/core';
import {native} from './api';
const Updater=registerPlugin('AppUpdater');
export function setupAppUpdates(){
 if(!native)return;
 const $=s=>document.querySelector(s),panel=$('#app-update-panel');let state=null,busy=false,lastCheck=0;
 try{$('#auto-app-download').checked=JSON.parse(localStorage.getItem('plu:auto-update-download:v1')||'true')!==false;}catch{}
 $('#auto-app-download').onchange=()=>{try{localStorage.setItem('plu:auto-update-download:v1',JSON.stringify($('#auto-app-download').checked));}catch{}};
 function status(text){$('#app-update-status').textContent=text;}
 function render(){
  if(!state)return;
  $('#download-app-update').hidden=!state.available||state.ready;
  $('#install-app-update').hidden=!state.available||!state.ready||!state.canInstall;
  $('#allow-app-updates').hidden=!state.available||!state.ready||state.canInstall;
  if(state.available){panel.hidden=false;status(state.ready?`Update ${state.versionName} is downloaded and verified. ${state.canInstall?'Tap Install; Android will ask for confirmation.':'Allow app updates in Android settings, then tap Install.'}`:`Update ${state.versionName} is available (${(state.size/1048576).toFixed(1)}MB). ${state.unmetered?'Ready to download.':'Automatic downloads wait for an unmetered connection.'}`);}
  else status(`Installed version ${state.installedVersion}. ${state.checked?'No newer release is published.':'Check for newer releases when connected.'}`);
 }
 async function download(auto=false){
  if(busy)return;busy=true;panel.hidden=false;$('#download-app-update').disabled=true;status('Downloading update. The APK will be checked before installation…');
  try{state=await Updater.download({unmeteredOnly:auto});render();}catch(e){status(e.message||'Download failed; nothing was installed.');}finally{busy=false;$('#download-app-update').disabled=false;}
 }
 async function check(force=false){
  if(busy)return;busy=true;$('#check-app-update').disabled=true;let auto=false;
  try{state=await Updater.info();render();if(!force&&Date.now()-lastCheck<4*3600000)return;
   state=await Updater.check();state.checked=true;lastCheck=Date.now();render();auto=state.available&&!state.ready&&state.unmetered&&$('#auto-app-download').checked;
  }catch(e){if(!panel.hidden)status(e.message||'Could not check for updates.');}
  finally{busy=false;$('#check-app-update').disabled=false;}
  if(auto)await download(true);
 }
 $('#check-app-update').onclick=()=>check(true);$('#download-app-update').onclick=()=>download(false);
 $('#allow-app-updates').onclick=async()=>{try{await Updater.settings();status('Return from Android settings, then tap Check now / Install. Android controls this permission.');}catch(e){status(e.message);}};
 $('#install-app-update').onclick=async()=>{try{await Updater.install();status('Android installer opened. Approve the update there; if cancelled, you can tap Install again.');}catch(e){status(e.message);}};
 $('#nav-updates').onclick=()=>{panel.hidden=false;panel.scrollIntoView({behavior:'smooth',block:'start'});check(true);};
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});window.addEventListener('online',()=>check());
 setInterval(()=>{if(!document.hidden)check();},4*3600000);check();
}

const{emptyRows,validateRows}=require('../shared/floor-list');
// All drafts are RAM-only here. Only explicit account mode may call PUT.
function createFloorSync({model,api,changed=()=>{},chooseGuest=async()=> 'guest',delay=700}){
 let viewVersion=0;const install=rows=>{model.replace(rows);viewVersion++;};
 let account=null,mode='guest',revision=0,dirty=false,conflict=false,busy=false,epoch=0,edits=0,timer=null,status='Guest draft: RAM-only, not uploaded. Reload/restart clears it.',guest=emptyRows();
 const publish=()=>changed({mode,account,revision,dirty,conflict,busy,status,viewVersion,editable:mode!=='loading'});
 const cancelTimer=()=>{clearTimeout(timer);timer=null;};
 function schedule(){cancelTimer();if(mode==='account'&&dirty&&!conflict&&!busy)timer=setTimeout(()=>void save(),delay);}
 function edit(){if(mode==='loading')return;edits++;if(mode==='account'){dirty=true;status='Unsaved account changes.';schedule();}else{guest=model.rows;status='Guest draft: RAM-only, not uploaded.';}publish();}
 async function save(){cancelTimer();if(mode!=='account'||!dirty||busy||conflict)return;const e=epoch,version=edits,rows=model.rows,base=revision;busy=true;status='Saving private account list…';publish();
  try{const result=await api.put({rows,revision:base});if(e!==epoch)return;if(!Number.isSafeInteger(result.revision)||result.revision!==base+1)throw Error('Invalid save acknowledgement');revision=result.revision;dirty=edits!==version;status=dirty?'More account changes pending.':'Saved to your account. Sign-in expiry does not delete this saved list.';}
  catch(error){if(e!==epoch)return;if(error.status===401){signOut();return;}conflict=error.status===409;status=conflict?'Conflict: another device saved changes. Your edits are kept. Reload saved explicitly to discard them.':'Not saved: connection/request failed. Edits stay in this open account session; retry when online.';}
  finally{if(e===epoch){busy=false;publish();if(dirty&&!conflict&&status.startsWith('More'))schedule();}}
 }
 function signOut(){epoch++;cancelTimer();account=null;mode='guest';revision=0;dirty=false;conflict=false;busy=false;install(guest);status='Signed out. Account list removed from this view; guest draft remains RAM-only.';publish();}
 async function load(identity,{force=false,adopt=false}={}){
  const previousMode=mode,previousDirty=dirty;const e=++epoch;cancelTimer();account=identity;mode='loading';busy=false;conflict=false;status='Loading private saved list. No guest draft has been uploaded.';publish();
  try{const result=await api.get();validateRows(result.rows);if(!Number.isSafeInteger(result.revision)||result.revision<0)throw Error('Invalid revision');if(e!==epoch)return;
   let choice=adopt?'upload':'saved';if(!force&&!adopt&&guest.some(x=>x.text.length||x.checked))choice=await chooseGuest();if(e!==epoch)return;
   if(choice==='guest'){mode='guest-hold';status='Signed in, but this guest draft is not uploaded. Choose Use account to switch.';publish();return;}
   revision=result.revision;install(choice==='upload'?guest:result.rows);mode='account';dirty=choice==='upload';edits++;status=dirty?'Guest upload approved; account save pending.':'Saved account list loaded.';publish();if(dirty)schedule();
  }catch(error){if(e!==epoch)return;if(error.status===401){signOut();return;}if(previousMode==='account'){mode='account';dirty=previousDirty;status='Reload failed. Existing account work is kept privately in this view; retry explicitly.';publish();return;}mode='guest-hold';status='Account list unavailable. Nothing uploaded; guest draft retained. Reconnect and use account again.';publish();}
 }
 async function auth(state){if(!state.authenticated){if(account)signOut();return;}if(typeof state.accountId!=='string')return;if(account===state.accountId&&mode!=='guest')return;
  if(mode==='guest'||mode==='guest-hold')guest=model.rows;else{guest=emptyRows();install(guest);mode='guest';revision=0;}dirty=false;return load(state.accountId);
 }
 async function reload(){if(!account)return;if(dirty&&!await api.confirmDiscard())return;return load(account,{force:true});}
 async function useAccount(){if(!account)return;guest=model.rows;return load(account);}
 return{edit,save,auth,signOut,reload,useAccount,publish,dispose:()=>{epoch++;cancelTimer();}};
}
module.exports={createFloorSync};

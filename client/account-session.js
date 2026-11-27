// Token is RAM-only here; native adapter encrypts it in Android Keystore storage.
function createAccountSession({native,storage,send,onChange=()=>{}}){
 let token=null,info={authenticated:false},generation=0,epoch=0,loaded=false,loading=null,checking=null,checkingGeneration=-1;
 const snapshot=()=>({...info});
 const notify=()=>onChange(snapshot());
 async function clearStore(){if(native){const result=await storage.clear();epoch=result.generation;}}
 function invalidate(){generation++;token=null;info={authenticated:false};notify();}
 async function ready(){if(!native||loaded)return;if(loading)return loading;const g=generation;loading=(async()=>{const data=await storage.load();if(g!==generation)return;epoch=data.generation;token=data.token||null;loaded=true;})().finally(()=>{loading=null;});return loading;}
 async function expire(g){if(g!==generation)return;invalidate();loaded=true;await clearStore();}
 async function request(path,options={}){const g=generation,captured=token;try{return await send(path,options,captured);}catch(error){if(error.status===401&&g===generation&&(captured||!native)&&!path.endsWith('/login'))await expire(g).catch(()=>{});throw error;}}
 async function me(){await ready();if(native&&!token)return snapshot();if(checking&&checkingGeneration===generation)return checking;const g=generation;const operation=(async()=>{const data=await request(native?'/api/app/me':'/api/me');if(g!==generation)return snapshot();info=data;notify();return snapshot();})().finally(()=>{if(checking===operation)checking=null;});checking=operation;checkingGeneration=g;return operation;}
 async function login(username,password){invalidate();loaded=true;const g=generation;await clearStore();if(g!==generation)throw Error('Sign-in cancelled.');const saveEpoch=epoch;
  const data=await send(native?'/api/app/login':'/api/login',{method:'POST',data:{username,password}},null);
  if(g!==generation){if(native&&data.token)send('/api/app/logout',{method:'POST'},data.token).catch(()=>{});throw Error('Sign-in cancelled.');}
  if(native){try{await storage.save({token:data.token,expiresAt:data.expiresAt,generation:saveEpoch});}catch{send('/api/app/logout',{method:'POST'},data.token).catch(()=>{});throw Error('Secure sign-in storage is unavailable. No plaintext fallback was used.');}}
  if(g!==generation){if(native)send('/api/app/logout',{method:'POST'},data.token).catch(()=>{});throw Error('Sign-in cancelled.');}token=native?data.token:null;info={...data,authenticated:true};delete info.token;notify();return snapshot();
 }
 async function logout(){const old=token;invalidate();loaded=true;const local=clearStore();const remote=send(native?'/api/app/logout':'/api/logout',{method:'POST'},old).catch(()=>{});await local;await remote;}
 function cancel(){invalidate();loaded=true;return clearStore();}
 return{me,login,logout,request,cancel,snapshot};
}
module.exports={createAccountSession};

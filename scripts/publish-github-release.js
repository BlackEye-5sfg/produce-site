// Post-deployment mirror only: never rebuild APKs or change the first-party updater feed.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),os=require('node:os'),{spawnSync}=require('node:child_process');
const REPO='JinxOnPurpose-Labs/plu-hub',REPO_ID=1466042397,APP_ID='xyz.xanderxx.pluhub',SIGNER='85e949227ef266def49d6713ad2b23a2ad91c8249fc605c8936588cad3795dc8',FEED='https://plus.xanderxx.xyz/updates/latest.json';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function requireThat(ok,message){if(!ok)throw Error(message);}
function validateEvidence(apk,feed,proof,run,gradle){
 requireThat(Buffer.isBuffer(apk)&&apk.length>0&&apk.length<=50*1024*1024&&apk.subarray(0,4).equals(Buffer.from([80,75,3,4])),'Invalid APK bytes/size');
 requireThat(/^\d+\.\d+\.\d+$/.test(feed.versionName||'')&&Number.isSafeInteger(feed.versionCode)&&feed.versionCode>0,'Invalid release version');
 requireThat(feed.appId===APP_ID&&feed.url===`https://plus.xanderxx.xyz/downloads/plu-hub-${feed.versionName}.apk`,'Unexpected package/download destination');
 requireThat(feed.size===apk.length&&feed.sha256===sha(apk),'Artifact size/SHA256 differs from release manifest');
 requireThat(proof.apkSha256===feed.sha256&&proof.bytes===feed.size&&proof.appId===APP_ID,'Independent verification is for different bytes/package');
 requireThat(proof.apkV2SignatureVerified===true&&proof.contentDigestVerified===true&&proof.matchesProtectedSigningCertificate===true&&proof.signerCertificateSha256===SIGNER,'Missing trusted independent APK signature/content/signer evidence');
 requireThat(/^[0-9a-f]{40}$/.test(proof.sourceCommit||'')&&Number.isSafeInteger(proof.ciRun)&&proof.ciRun>0,'Missing source/CI provenance');
 requireThat(run.id===proof.ciRun&&run.head_sha===proof.sourceCommit&&run.repository?.id===REPO_ID&&run.status==='completed'&&run.conclusion==='success','CI source/repository/result mismatch');
 requireThat(['push','workflow_dispatch'].includes(run.event)&&String(run.path||'').split('@')[0]==='.github/workflows/android.yml','Unexpected source build workflow/event');
 requireThat(gradle.match(/applicationId\s+"([^"]+)"/)?.[1]===APP_ID,'Source package differs from installed app');
 requireThat(Number(gradle.match(/versionCode\s+(\d+)/)?.[1])===feed.versionCode&&gradle.match(/versionName\s+"([^"]+)"/)?.[1]===feed.versionName,'Source Android version differs from released artifact');
 return{tag:`v${feed.versionName}`,apkName:`plu-hub-${feed.versionName}.apk`,source:proof.sourceCommit};
}
async function boundedFetch(url,max){
 const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(120000),headers:{'User-Agent':'PLUHubAndroidUpdater/2.4'}});requireThat(response.status===200,'Published first-party asset is unavailable');const length=response.headers.get('content-length');requireThat(!length||Number(length)<=max,'Published asset exceeds size limit');let size=0,chunks=[];for await(const chunk of response.body){size+=chunk.length;requireThat(size<=max,'Published asset exceeds size limit');chunks.push(Buffer.from(chunk));}return Buffer.concat(chunks);
}
function gh(args,input,missing=false){
 const r=spawnSync(process.env.PLU_GH_BIN||'gh',args,{encoding:'utf8',input:input===undefined?undefined:JSON.stringify(input),maxBuffer:8*1024*1024});
 if(r.status!==0){if(missing&&/HTTP 404/.test(r.stderr||''))return null;throw Error('GitHub operation failed; inspect draft/tag state before retrying');}return r.stdout.trim()?JSON.parse(r.stdout):null;
}
const api=(endpoint,method='GET',data,missing=false)=>gh(['api',endpoint,'--method',method,...(data===undefined?[]:['--input','-'])],data,missing);
function ghCommand(args){const r=spawnSync(process.env.PLU_GH_BIN||'gh',args,{encoding:'utf8',maxBuffer:1024*1024});requireThat(r.status===0,'Release command failed; inspect draft/assets before retrying');}
async function main(argv){
 const options={};for(let i=0;i<argv.length;i+=2){requireThat(['--apk','--manifest','--verification','--notes'].includes(argv[i])&&argv[i+1],'Usage: --apk FILE --manifest FILE --verification TRUSTED_JSON --notes FILE');options[argv[i]]=argv[i+1];}requireThat(Object.keys(options).length===4,'All four input files are required');
 const apk=fs.readFileSync(options['--apk']),feed=JSON.parse(fs.readFileSync(options['--manifest'],'utf8')),proof=JSON.parse(fs.readFileSync(options['--verification'],'utf8')),notes=fs.readFileSync(options['--notes'],'utf8');requireThat(notes.trim()&&!/(?:gh[pousr]_[A-Za-z0-9_]{15,}|github_pat_[A-Za-z0-9_]+|BEGIN[^\n]*PRIVATE KEY)/.test(notes),'Empty or potentially secret-bearing release notes');
 const repo=api(`repos/${REPO}`);requireThat(repo.id===REPO_ID&&repo.private===false&&repo.permissions?.push===true,'Unexpected repository/privacy/permission');
 const run=api(`repos/${REPO}/actions/runs/${proof.ciRun}`),sourceFile=api(`repos/${REPO}/contents/android/app/build.gradle?ref=${proof.sourceCommit}`),gradle=Buffer.from(sourceFile.content,'base64').toString();const release=validateEvidence(apk,feed,proof,run,gradle);
 const live=JSON.parse((await boundedFetch(FEED,16384)).toString());requireThat(JSON.stringify(live)===JSON.stringify(feed),'First-party updater feed does not identify this currently deployed release');const hosted=await boundedFetch(feed.url,50*1024*1024);requireThat(hosted.length===apk.length&&sha(hosted)===feed.sha256,'Hosted APK differs from verified artifact');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'plu-github-release-'));fs.chmodSync(dir,0o700);
 try{
  const provenance={appId:APP_ID,versionName:feed.versionName,versionCode:feed.versionCode,apkSha256:feed.sha256,apkBytes:feed.size,signerCertificateSha256:SIGNER,sourceCommit:proof.sourceCommit,sourceBuildRun:proof.ciRun,sourceBuildUrl:`https://github.com/${REPO}/actions/runs/${proof.ciRun}`,firstPartyDownload:feed.url,independentApkV2AndContentDigestVerified:true,physicalAndroidTestClaimed:false};
  const files={[release.apkName]:apk,'latest.json':Buffer.from(JSON.stringify(feed,null,2)+'\n'),'provenance.json':Buffer.from(JSON.stringify(provenance,null,2)+'\n')};files.SHA256SUMS=Buffer.from(Object.entries(files).map(([name,bytes])=>`${sha(bytes)}  ${name}`).join('\n')+'\n');for(const[name,bytes]of Object.entries(files))fs.writeFileSync(path.join(dir,name),bytes,{mode:0o600});
  const tag=api(`repos/${REPO}/git/ref/tags/${release.tag}`,'GET',undefined,true);if(tag){let target=tag.object;for(let n=0;n<3&&target.type==='tag';n++)target=api(`repos/${REPO}/git/tags/${target.sha}`).object;requireThat(target.type==='commit'&&target.sha===release.source,'Version tag already points at different source');}
  const existing=api(`repos/${REPO}/releases/tags/${release.tag}`,'GET',undefined,true);
  function verifyAssets(r){const assets=api(`repos/${REPO}/releases/${r.id}/assets`);requireThat(assets.length===Object.keys(files).length,'Unexpected/missing release assets');for(const[name,bytes]of Object.entries(files)){const a=assets.find(x=>x.name===name);requireThat(a&&a.size===bytes.length&&a.digest===`sha256:${sha(bytes)}`,'Uploaded asset digest/size mismatch');}}
  if(existing){requireThat(!existing.draft,'Draft exists: inspect it before resuming, never overwrite blindly');verifyAssets(existing);console.log(JSON.stringify({alreadyPublished:true,url:existing.html_url,tag:release.tag}));return;}
  if(!tag)api(`repos/${REPO}/git/refs`,'POST',{ref:`refs/tags/${release.tag}`,sha:release.source});
  const body=notes.trim()+`\n\n### Verified release identity\n- Source: \`${release.source}\`\n- Signed APK SHA256: \`${feed.sha256}\`\n- Stable signer SHA256: \`${SIGNER}\`\n- Original successful build: [${proof.ciRun}](${provenance.sourceBuildUrl})\n\nThe APK is an exact mirror of the already-published first-party download. The Android updater still uses the existing first-party host and normal user-confirmed installation.\n`;
  const draft=api(`repos/${REPO}/releases`,'POST',{tag_name:release.tag,target_commitish:release.source,name:`PLU Hub ${feed.versionName}`,body,draft:true,prerelease:false});
  ghCommand(['release','upload',release.tag,...Object.keys(files).map(name=>path.join(dir,name)),'--repo',REPO]);verifyAssets(draft);
  const stillLive=JSON.parse((await boundedFetch(FEED,16384)).toString());requireThat(stillLive.sha256===feed.sha256&&stillLive.versionCode===feed.versionCode,'Live release changed; leave draft for inspection');
  const published=api(`repos/${REPO}/releases/${draft.id}`,'PATCH',{draft:false,make_latest:'true'});requireThat(!published.draft,'Publication not confirmed');verifyAssets(published);console.log(JSON.stringify({published:true,url:published.html_url,tag:release.tag,source:release.source,apkSha256:feed.sha256,assetCount:Object.keys(files).length}));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
if(require.main===module)main(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={validateEvidence,sha,REPO_ID,APP_ID,SIGNER};

const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
function manifest(apk,gradle,config){
 const versionCode=Number(gradle.match(/versionCode\s+(\d+)/)?.[1]);const versionName=gradle.match(/versionName\s+"([0-9]+\.[0-9]+\.[0-9]+)"/)?.[1];
 if(config.appId!=='xyz.xanderxx.pluhub'||!Number.isSafeInteger(versionCode)||versionCode<1||versionCode>2100000000||!versionName)throw Error('Invalid Android release configuration');
 if(!Buffer.isBuffer(apk)||!apk.length||apk.length>50*1024*1024)throw Error('Invalid APK size');
 return{appId:config.appId,versionCode,versionName,url:`https://plus.xanderxx.xyz/downloads/plu-hub-${versionName}.apk`,size:apk.length,sha256:crypto.createHash('sha256').update(apk).digest('hex')};
}
if(require.main===module){const[apkPath,out]=process.argv.slice(2);if(!apkPath||!out)throw Error('Usage: node scripts/release-manifest.js signed.apk latest.json');
 const root=path.join(__dirname,'..'),result=manifest(fs.readFileSync(apkPath),fs.readFileSync(path.join(root,'android/app/build.gradle'),'utf8'),JSON.parse(fs.readFileSync(path.join(root,'capacitor.config.json'),'utf8')));
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(`Generated release feed for${result.versionName}; publish ONLY after APK signature and hosted hash verification.`);
}
module.exports={manifest};

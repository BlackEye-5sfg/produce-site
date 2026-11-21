const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function imageData(dataUrl){
 if(typeof dataUrl!=='string')throw Error('Choose a JPEG or PNG photo.');
 const match=dataUrl.match(/^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/);if(!match)throw Error('Choose a JPEG or PNG photo.');
 const bytes=Buffer.from(match[2],'base64');if(bytes.toString('base64')!==match[2]||bytes.length>512*1024||bytes.length<24)throw Error('Photo must be a valid JPEG/PNG under512KB.');
 let width=0,height=0;
 if(match[1]==='png'){
  if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||bytes.toString('ascii',12,16)!=='IHDR')throw Error('Invalid PNG.');
  width=bytes.readUInt32BE(16);height=bytes.readUInt32BE(20);
 }else{
  if(bytes[0]!==255||bytes[1]!==216)throw Error('Invalid JPEG.');let p=2;
  while(p+4<bytes.length){if(bytes[p++]!==255)break;while(bytes[p]===255)p++;const marker=bytes[p++];if(marker===217||marker===218)break;if(marker===1||(marker>=208&&marker<=215))continue;const n=bytes.readUInt16BE(p);if(n<2||p+n>bytes.length)break;if([192,193,194].includes(marker)){height=bytes.readUInt16BE(p+3);width=bytes.readUInt16BE(p+5);break;}p+=n;}
 }
 if(!width||!height||width>1600||height>1600)throw Error('Resize the photo to1600px or less.');
 return{bytes,extension:match[1]==='png'?'png':'jpg'};
}
function savePhoto(dir,dataUrl){
 const image=imageData(dataUrl);fs.mkdirSync(dir,{recursive:true,mode:0o700});if(fs.lstatSync(dir).isSymbolicLink())throw Error('Photo storage needs review.');
 const files=fs.readdirSync(dir).filter(x=>/^[a-f0-9]{64}\.(jpg|png)$/.test(x));let size=0;for(const name of files){const s=fs.lstatSync(path.join(dir,name));if(!s.isFile())throw Error('Photo storage needs review.');size+=s.size;}
 const name=crypto.createHash('sha256').update(image.bytes).digest('hex')+'.'+image.extension,target=path.join(dir,name);
 if(!fs.existsSync(target)){if(size+image.bytes.length>100*1024*1024)throw Error('Photo storage limit reached.');fs.writeFileSync(target,image.bytes,{flag:'wx',mode:0o600});}
 return '/photos/'+name;
}
module.exports={imageData,savePhoto};

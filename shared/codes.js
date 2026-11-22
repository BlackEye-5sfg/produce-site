// Code values are text, never numeric IDs. Formatting must not truncate or repair them.
const CODE_TYPES={plu:'PLU (4–5 digits)',upca:'UPC-A (12 digits)',upce:'UPC-E (8 digits)',ean13:'EAN-13 (13 digits)',ean8:'EAN-8 (8 digits)',gtin14:'GTIN-14 / ITF',itf:'ITF (even-length digits)',code128:'Code 128 / internal code',code39:'Code 39'};
const SCAN_TYPES={UPC_A:'upca',UPC_E:'upce',EAN_13:'ean13',EAN_8:'ean8',CODE_128:'code128',CODE_39:'code39',ITF:'itf'};
function validGTIN(value){if(!/^\d{8}$|^\d{12,14}$/.test(value))return false;let sum=0;const body=value.slice(0,-1);for(let i=body.length-1,j=0;i>=0;i--,j++)sum+=Number(body[i])*(j%2?1:3);return (10-sum%10)%10===Number(value.at(-1));}
function expandUPCE(code){
 if(!/^[01]\d{7}$/.test(code))return null;const ns=code[0],d=code.slice(1,7),check=code[7],last=d[5];let body;
 if('012'.includes(last))body=ns+d.slice(0,2)+last+'0000'+d.slice(2,5);
 else if(last==='3')body=ns+d.slice(0,3)+'00000'+d.slice(3,5);
 else if(last==='4')body=ns+d.slice(0,4)+'00000'+d[4];
 else body=ns+d.slice(0,5)+'0000'+last;return body+check;
}
function validateCode(value,type){
 if(typeof value!=='string')return{error:'Enter codes as text to preserve leading zeros.'};
 if(!value.length||value.length>80||!/^\x20*[\x21-\x7e][\x20-\x7e]*$/.test(value)||value!==value.trim())return{error:'Use 1–80 printable characters, with no outer whitespace.'};
 if(type!==undefined&&type!==null&&typeof type!=='string')return{error:'Choose a supported code format.'};
 type=type||'auto';if(type==='auto'){
  if(/^\d{1,3}$/.test(value))return{error:'PLUs need four or five digits. Choose Code128 explicitly for a shorter internal code.'};
  if(/^\d{4,5}$/.test(value))type='plu';else if(/^\d{12}$/.test(value))type='upca';else if(/^\d{13}$/.test(value))type='ean13';else if(/^\d{14}$/.test(value))type='gtin14';
  else if(/^\d{8}$/.test(value))return{error:'For eight digits, choose EAN-8 or UPC-E from the label.'};else type='code128';
 }
 if(!Object.hasOwn(CODE_TYPES,type))return{error:'Choose a supported code format.'};
 if(type==='plu'&&!/^\d{4,5}$/.test(value))return{error:'PLUs must contain four or five digits. Choose another format for a barcode.'};
 const lengths={upca:12,ean13:13,ean8:8,gtin14:14};
 if(Object.hasOwn(lengths,type)&&(!new RegExp('^\\d{'+lengths[type]+'}$').test(value)||!validGTIN(value)))return{error:`${CODE_TYPES[type]} length or check digit is invalid. The code was not changed.`};
 if(type==='upce'){const expanded=expandUPCE(value);if(!expanded||!validGTIN(expanded))return{error:'UPC-E must contain eight valid digits, including number-system and check digit.'};}
 if(type==='itf'&&(!/^\d{6,80}$/.test(value)||value.length%2))return{error:'ITF needs an even number of digits (6–80).'};
 if(type==='code39'&&!/^[0-9A-Z\-. $/+%]+$/.test(value))return{error:'Code39 uses uppercase letters, digits and -. $/+% only.'};
 return{value,type};
}
function barcodeSpec(item){
 const value=String(item.plu??''),type=item.code_type||'plu',validated=validateCode(value,type);if(validated.error)throw Error(validated.error);
 if(type==='plu')return{format:'upc',value:'000000'+value.padStart(5,'0'),legacy:true};
 return{format:({upca:'upc',upce:'UPCE',ean13:'EAN13',ean8:'EAN8',gtin14:'ITF',itf:'ITF',code128:'CODE128',code39:'CODE39'})[type],value,legacy:false};
}
module.exports={CODE_TYPES,SCAN_TYPES,validateCode,validGTIN,expandUPCE,barcodeSpec};

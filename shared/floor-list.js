// Private account data contract. Never include rows in catalogue/audit events.
const MAX_ROWS=200,MAX_TEXT=1000;
function validateRows(rows){
 if(!Array.isArray(rows)||rows.length<1||rows.length>MAX_ROWS)throw Error('Use 1–200 floor-list rows.');
 const ids=new Set();const result=rows.map(row=>{
  if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).sort().join(',')!=='checked,id,text'||!Number.isSafeInteger(row.id)||row.id<1||row.id>2147483646||ids.has(row.id)||typeof row.text!=='string'||row.text.length>MAX_TEXT||/[\r\n]/.test(row.text)||typeof row.checked!=='boolean')throw Error('Invalid floor-list row.');
  ids.add(row.id);return{id:row.id,text:row.text,checked:row.checked};
 });
 if(BufferByteLength(JSON.stringify(result))>900000)throw Error('Floor list is too large.');return result;
}
function BufferByteLength(text){return new TextEncoder().encode(text).length;}
const emptyRows=()=>[{id:1,text:'',checked:false}];
module.exports={validateRows,emptyRows,MAX_ROWS,MAX_TEXT};

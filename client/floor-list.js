// Deliberately memory-only. Never connect this list to API, storage, catalogue or telemetry.
const MAX_ROWS=200,MAX_TEXT=1000;
function createFloorList(){
 let nextId=1,rows=[{id:nextId++,text:'',checked:false}];
 const get=id=>{const row=rows.find(x=>x.id===id);if(!row)throw Error('This row no longer exists.');return row;};
 function edit(id,value,caret=value.length){
  const row=get(id),parts=String(value).replace(/\r\n?/g,'\n').split('\n');
  if(rows.length+parts.length-1>MAX_ROWS)throw Error(`Keep this session list to ${MAX_ROWS} lines.`);
  if(parts.some(x=>x.length>MAX_TEXT))throw Error(`Keep each line to ${MAX_TEXT} characters. Nothing was clipped.`);
  const normalized=String(value).replace(/\r\n?/g,'\n'),before=String(value).slice(0,caret).replace(/\r\n?/g,'\n'),line=before.split('\n').length-1,column=before.split('\n').at(-1).length;
  const index=rows.indexOf(row);row.text=parts[0];const added=parts.slice(1).map(text=>({id:nextId++,text,checked:false}));rows.splice(index+1,0,...added);
  return{id:rows[index+Math.min(line,parts.length-1)].id,caret:Math.min(column,normalized.length),split:added.length>0};
 }
 return{
  get rows(){return rows.map(x=>({...x}));},
  edit,
  breakLine(id,start,end=start){const row=get(id);return edit(id,row.text.slice(0,start)+'\n'+row.text.slice(end),start+1);},
  check(id,value){get(id).checked=Boolean(value);},
  add(){if(!rows.at(-1).text&&!rows.at(-1).checked)return rows.at(-1).id;if(rows.length>=MAX_ROWS)throw Error(`Keep this session list to ${MAX_ROWS} lines.`);const row={id:nextId++,text:'',checked:false};rows.push(row);return row.id;},
  remove(id){const index=rows.indexOf(get(id));rows.splice(index,1);if(!rows.length)rows.push({id:nextId++,text:'',checked:false});return rows[Math.min(index,rows.length-1)].id;}
 };
}
function mountFloorList(document){
 const $=s=>document.querySelector(s),dialog=$('#floor-list-dialog'),root=$('#floor-list-rows'),list=createFloorList();
 function status(){const rows=list.rows.filter(x=>x.text.trim()),done=rows.filter(x=>x.checked).length;$('#floor-list-count').textContent=`${rows.length-done} needed · ${done} checked`;}
 function focus(id,caret){const input=root.querySelector(`[data-row="${id}"] textarea`);if(!input)return;input.focus();input.setSelectionRange(caret??input.value.length,caret??input.value.length);input.scrollIntoView({block:'nearest'});}
 function height(input){input.style.height='auto';input.style.height=Math.max(44,input.scrollHeight)+'px';}
 function error(e){$('#floor-list-error').textContent=e.message;}
 function apply(row,input){if(!input.isConnected)return;try{const result=list.edit(row.id,input.value,input.selectionStart);$('#floor-list-error').textContent='';if(result.split){render();focus(result.id,result.caret);}else{height(input);status();}}catch(e){input.value=list.rows.find(x=>x.id===row.id).text;height(input);error(e);}}
 function render(){root.replaceChildren();for(const row of list.rows){
  const line=document.createElement('div');line.className='floor-list-row';line.dataset.row=row.id;line.classList.toggle('checked',row.checked);
  const check=document.createElement('input');check.type='checkbox';check.checked=row.checked;check.setAttribute('aria-label','Mark item checked');check.onchange=()=>{list.check(row.id,check.checked);line.classList.toggle('checked',check.checked);status();};
  const input=document.createElement('textarea');input.rows=1;input.value=row.text;input.placeholder='What does the floor need?';input.setAttribute('aria-label','Sales-floor item');input.setAttribute('enterkeyhint','enter');input.autocomplete='off';input.dataset.private='session-only';
  input.addEventListener('keydown',e=>{if(!input.isConnected)return;if(e.key!=='Enter'||e.isComposing||e.keyCode===229)return;e.preventDefault();try{const result=list.breakLine(row.id,input.selectionStart,input.selectionEnd);$('#floor-list-error').textContent='';render();focus(result.id,result.caret);}catch(err){error(err);}});
  input.addEventListener('beforeinput',e=>{if(!input.isConnected)return;if(!['insertLineBreak','insertParagraph'].includes(e.inputType)||e.isComposing||!e.cancelable)return;e.preventDefault();try{const result=list.breakLine(row.id,input.selectionStart,input.selectionEnd);$('#floor-list-error').textContent='';render();focus(result.id,result.caret);}catch(err){error(err);}});
  input.addEventListener('input',e=>{if(!e.isComposing)apply(row,input);});input.addEventListener('compositionend',()=>apply(row,input));
  const remove=document.createElement('button');remove.type='button';remove.className='icon-btn';remove.textContent='×';remove.setAttribute('aria-label','Delete item');remove.onclick=()=>{const id=list.remove(row.id);$('#floor-list-error').textContent='';render();focus(id);};
  line.append(check,input,remove);root.append(line);height(input);
 }status();}
 function open(){if(!dialog.open)dialog.showModal();for(const input of root.querySelectorAll('textarea'))height(input);focus(list.rows.at(-1).id);}
 $('#open-floor-list').onclick=open;$('#nav-floor-list').onclick=open;$('#close-floor-list').onclick=()=>dialog.close();$('#add-floor-item').onclick=()=>{try{const id=list.add();$('#floor-list-error').textContent='';render();focus(id);}catch(e){error(e);}};
 render();
}
module.exports={createFloorList,mountFloorList};

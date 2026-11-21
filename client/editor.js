import { request, adminPath, auditPath, logout, native, mediaURL } from './api';
import { CATEGORIES, TAGS, parseImport, tagLabels } from '../shared/catalog';
import { resizedPhoto } from './lookup-tools';
import {scanBarcode} from './barcode-scanner';
import {CODE_TYPES,validateCode} from '../shared/codes';
export function mountEditor(root, { onChange = () => {}, onLogout = () => {} } = {}) {
  let items = [], editing = null, previewId = null, photoBusy = false, scanBusy = false;
  root.innerHTML = `<div class="editor-top"><div><p class="eyebrow">YOUR CATALOG</p><h1>Make a little change.</h1><p class="muted">One catalog. Changes show on the website and app.</p></div><button class="btn quiet" id="signout">Sign out</button></div>
  <div class="editor-tools"><label class="search compact"><span>⌕</span><input id="admin-search" type="search" placeholder="Find a name or PLU…" aria-label="Search catalog"></label><button class="btn" id="new-item">＋ Add item</button><button class="btn quiet" id="scan-add" hidden>Scan to add</button><button class="btn quiet" id="history">Activity</button><button class="btn quiet" id="bulk-tools">Bulk edit / import</button><button class="btn quiet" id="refresh-admin">Refresh</button></div>
  <p id="editor-status" role="status" class="message"></p><div class="table-wrap"><table><thead><tr><th>Produce</th><th>Code</th><th>Category</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody id="admin-rows"></tbody></table></div>
  <dialog id="item-dialog"><form id="item-form"><div class="dialog-head"><h2 id="form-title">Add produce</h2><button type="button" class="icon-btn" id="close-item" aria-label="Close">×</button></div>
  <div class="scan-controls"><button type="button" class="btn quiet" id="scan-code" hidden>Scan barcode</button><p class="small muted" id="scan-help">Enter/paste a code or use a keyboard scanner. Camera scanning is in the Android app.</p></div><label>Code<input name="plu" required type="text" inputmode="text" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="PLU, UPC/EAN or internal code"></label><label>Code format<select name="code_type" id="code-type"><option value="auto">Auto (choose explicitly for ambiguous codes)</option></select></label><p class="message" id="code-status" role="status"></p>
  <label>Name<input name="name" required maxlength="120" autocomplete="off" placeholder="Enter the product name after reviewing the code"></label><label>Category<select name="cat"><option value="fruit">Fruit</option><option value="veg">Vegetables</option><option value="herbs">Herbs</option><option value="dry">Pantry</option></select></label>
  <div id="item-tag-fields" class="tag-filter-grid"></div><fieldset class="location-fields"><legend>Display locations (optional)</legend><div id="item-locations"></div></fieldset><label>Search aliases (one per line, up to12)<textarea name="aliases" rows="3" maxlength="600" placeholder="Scallion&#10;Spring onion"></textarea></label><section id="photo-tools"><h3>Optional product photo</h3><img id="photo-preview" class="photo-preview" hidden alt="Current product photo"><p class="small muted">Save new items first. Photos are public catalogue images. Use an appropriate photo you have permission to share. Images are resized and metadata stripped before upload.</p><input id="photo-file" type="file" accept="image/*" aria-label="Choose product photo"><div class="photo-actions"><button type="button" class="btn quiet tiny" id="upload-photo">Upload photo</button><button type="button" class="btn quiet tiny" id="remove-photo">Remove photo</button></div></section>
  <p class="muted small">Keep size/variety in the name. Only add codes you can verify for your store.</p><p class="message" id="form-error" role="alert"></p><button class="btn wide" type="submit" id="save-item">Save item</button></form></dialog>
  <dialog id="history-dialog"><div class="dialog-head"><h2>Recent activity</h2><button class="icon-btn" id="close-history" aria-label="Close">×</button></div><div id="audit-list"></div></dialog>
  <dialog id="bulk-dialog" class="bulk-dialog"><div class="dialog-head"><h2>Bulk edit / import</h2><button id="close-bulk" class="icon-btn" aria-label="Close">×</button></div><p class="small muted">Up to100 rows. Preview never saves. Existing codes update; new codes add. Input: JSON array or CSV with name,plu,cat. Optional: id,revision,code_type,organic,storage,locations,sale_unit,aliases. CSV lists use |. Categories: fruit,veg,herbs,dry (Pantry).</p><button id="load-filtered" class="btn quiet tiny">Load filtered catalogue for editing</button><label>Import file<input id="bulk-file" type="file" accept=".csv,.json,text/csv,application/json"></label><div id="bulk-tag-fields" class="tag-filter-grid"></div><button id="apply-bulk-tags" class="btn quiet tiny">Apply selected tags/category to input rows</button><label>Rows<textarea id="bulk-input" rows="8" spellcheck="false" placeholder="name,plu,cat"></textarea></label><p id="bulk-error" class="message" role="alert"></p><button id="preview-bulk" class="btn">Preview changes</button><div id="bulk-preview"></div><button id="confirm-bulk" class="btn wide" hidden>Confirm and save all changes</button></dialog>`;
  const $ = s => root.querySelector(s);
  const status = (text, bad = false) => { $('#editor-status').textContent = text; $('#editor-status').classList.toggle('bad', bad); };
  const labels = CATEGORIES;
  for(const[value,text]of Object.entries(CODE_TYPES))$('#code-type').add(new Option(text,value));
  $('#scan-code').hidden=!native;$('#scan-add').hidden=!native;if(native)$('#scan-help').textContent='Camera access is requested only when you tap Scan. Frames stay on this device; scans never auto-save.';
  function reviewCode(){const f=$('#item-form'),v=validateCode(f.elements.plu.value.trim(),f.elements.code_type.value);if(v.error){$('#code-status').textContent=v.error;return;}const duplicate=items.find(x=>x.plu===v.value&&x.id!==editing?.id);$('#code-status').textContent=duplicate?`Already saved as ${duplicate.name}. No duplicate will be added.`:`${CODE_TYPES[v.type]} · ${v.value.length} characters. Review the exact label before saving.`;}
  $('#item-form').elements.plu.addEventListener('input',reviewCode);$('#code-type').onchange=reviewCode;
  $('#item-form').elements.plu.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();reviewCode();$('#item-form').elements.name.focus();}});
  async function scan(){if(scanBusy||photoBusy)return;scanBusy=true;$('#scan-code').disabled=true;$('#save-item').disabled=true;$('#form-error').textContent='';try{const result=await scanBarcode();if(!result){$('#code-status').textContent='Scan cancelled. Nothing was changed or saved.';return;}const form=$('#item-form');form.elements.plu.value=result.value;form.elements.code_type.value=result.type;reviewCode();form.elements.name.focus();}catch(e){$('#form-error').textContent=e.message;}finally{scanBusy=false;$('#scan-code').disabled=false;$('#save-item').disabled=false;}}
  $('#scan-code').onclick=scan;$('#scan-add').onclick=()=>{open();scan();};

  const selectField=(key,options,root,labelText,bulk=false)=>{const label=document.createElement('label');label.textContent=labelText;const select=document.createElement('select');select.name=key;select.add(new Option(bulk?'Keep existing':'Not set',''));if(bulk&&key!=='cat')select.add(new Option('Clear tag','__clear'));for(const[value,text]of Object.entries(options))select.add(new Option(text,value));label.append(select);root.append(label);return select;};
  for(const key of ['organic','storage','sale_unit'])selectField(key,TAGS[key],$('#item-tag-fields'),({organic:'Growing method',storage:'Storage',sale_unit:'Sold by'})[key]);
  for(const[value,text]of Object.entries(TAGS.locations)){const label=document.createElement('label');const input=document.createElement('input');input.type='checkbox';input.name='locations';input.value=value;label.append(input,document.createTextNode(text));$('#item-locations').append(label);}
  selectField('cat',CATEGORIES,$('#bulk-tag-fields'),'Category',true);for(const key of ['organic','storage','sale_unit'])selectField(key,TAGS[key],$('#bulk-tag-fields'),key.replace('_',' '),true);
  function photoView(){const image=$('#photo-preview'),url=mediaURL(editing?.photo);image.hidden=!url;if(url)image.src=url;$('#upload-photo').disabled=!editing;$('#remove-photo').disabled=!editing?.photo;$('#photo-file').disabled=!editing;}
  async function changePhoto(remove=false){if(!editing||photoBusy)return;const target=editing;photoBusy=true;$('#save-item').disabled=true;$('#upload-photo').disabled=true;$('#remove-photo').disabled=true;try{const data={revision:target.revision};if(remove)data.remove=true;else data.dataUrl=await resizedPhoto($('#photo-file').files[0]);const result=await request(`${adminPath}/${target.id}/photo`,{method:'POST',data});if(editing?.id===target.id)editing=result;photoView();await refresh();onChange();$('#form-error').textContent='Photo updated.';}catch(e){$('#form-error').textContent=e.message;photoView();}finally{photoBusy=false;$('#save-item').disabled=false;}}
  $('#upload-photo').onclick=()=>changePhoto();$('#remove-photo').onclick=()=>changePhoto(true);
  async function refresh() {
    items = await request('/api/items'); render();
  }
  function render() {
    const query = $('#admin-search').value.toLowerCase(); const rows = $('#admin-rows'); rows.replaceChildren();
    for (const item of window.PLUSearch.searchItems(items, query, 'all')) {
      const tr = document.createElement('tr');
      for (const text of [item.name, item.plu, labels[item.cat] || item.cat]) { const td = document.createElement('td'); td.textContent = text; tr.append(td); }
      const td = document.createElement('td'); td.className = 'row-actions';
      const edit = document.createElement('button'); edit.className = 'btn tiny quiet'; edit.textContent = 'Edit'; edit.onclick = () => open(item);
      const del = document.createElement('button'); del.className = 'btn tiny danger'; del.textContent = 'Delete';
      del.onclick = async () => {
        if (!confirm(`Delete ${item.name} (${item.plu})? You can restore it from Activity.`)) return;
        del.disabled = true;
        try { await request(`${adminPath}/${item.id}`, { method: 'DELETE', data: { revision: item.revision } }); await refresh(); onChange(); status('Item removed. Restore it from Activity if needed.'); }
        catch (e) { status(e.message, true); await refresh().catch(() => {}); } finally { del.disabled = false; }
      };
      td.append(edit, del); tr.append(td); rows.append(tr);
    }
    if (!rows.children.length) { const tr = document.createElement('tr'), td = document.createElement('td'); td.colSpan = 4; td.textContent = 'No matching items.'; tr.append(td); rows.append(tr); }
  }
  function open(item) {
    if(photoBusy||scanBusy)return;editing = item || null; const form = $('#item-form'); form.reset(); $('#form-error').textContent = ''; $('#form-title').textContent = item ? 'Edit produce' : 'Add produce';
    if (item) for (const key of ['name','plu','cat','code_type','organic','storage','sale_unit']) form.elements[key].value = item[key] || '';
    form.elements.code_type.value=item?.code_type||'auto';$('#code-status').textContent='';form.elements.aliases.value=(item?.aliases||[]).join('\n');for(const c of root.querySelectorAll('[name=locations]'))c.checked=(item?.locations||[]).includes(c.value);photoView();
    $('#item-dialog').showModal();
  }
  $('#new-item').onclick = () => open(); $('#close-item').onclick = () => {if(!photoBusy&&!scanBusy)$('#item-dialog').close();}; $('#item-dialog').addEventListener('cancel',e=>{if(photoBusy||scanBusy)e.preventDefault();});
  $('#close-history').onclick = () => $('#history-dialog').close(); $('#admin-search').oninput = render; $('#refresh-admin').onclick = () => refresh().then(() => status('Catalog refreshed.')).catch(e => status(e.message, true));
  $('#signout').onclick = async () => { await logout().catch(() => {}); if (native) onLogout(); else location.href = '/'; };
  $('#item-form').onsubmit = async e => {
    e.preventDefault(); const f = new FormData(e.target); const data = { name: f.get('name'), plu: f.get('plu'), cat: f.get('cat'), code_type:f.get('code_type'), organic:f.get('organic'),storage:f.get('storage'),sale_unit:f.get('sale_unit'),locations:f.getAll('locations'),aliases:String(f.get('aliases')||'').split('\n').map(x=>x.trim()).filter(Boolean) };
    const checkedCode=validateCode(String(data.plu||'').trim(),data.code_type);if(checkedCode.error){$('#form-error').textContent=checkedCode.error;return;}data.plu=checkedCode.value;data.code_type=checkedCode.type;
    if (editing) data.revision = editing.revision;
    $('#save-item').disabled = true; $('#form-error').textContent = '';
    try {
      await request(editing ? `${adminPath}/${editing.id}` : adminPath, { method: editing ? 'PATCH' : 'POST', data });
      $('#item-dialog').close(); await refresh(); onChange(); status(editing ? 'Changes saved.' : 'Item added.');
    } catch (err) { $('#form-error').textContent = err.message; }
    finally { $('#save-item').disabled = false; }
  };
  $('#history').onclick = async () => {
    try {
      const entries = await request(auditPath); const list = $('#audit-list'); list.replaceChildren();
      if (!entries.length) list.textContent = 'No activity yet.';
      for (const entry of entries) {
        const row = document.createElement('article'); row.className = 'audit-entry';
        const before = entry.before_json ? JSON.parse(entry.before_json) : null; const after = entry.after_json ? JSON.parse(entry.after_json) : null;
        const title = document.createElement('strong'); title.textContent = `${entry.action} · ${(after || before)?.name || 'Item'}`;
        const meta = document.createElement('small'); meta.textContent = `${entry.created_at} UTC · ${entry.actor}`; row.append(title, meta);
        if (['delete','update','create','photo'].includes(entry.action) && !entry.undone_by) {
          const btn = document.createElement('button'); btn.className = 'btn tiny quiet'; btn.textContent = entry.action==='delete'?'Restore':'Undo';
          btn.onclick = async () => { btn.disabled = true; try { await request(`${auditPath}/${entry.id}/${entry.action==='delete'?'restore':'undo'}`, { method: 'POST', data: {} }); await refresh(); onChange(); btn.textContent = 'Undone'; } catch (e) { btn.disabled = e.status === 409; btn.textContent = e.status === 409 ? 'Changed, cannot undo' : 'Retry undo'; btn.title = e.message; status(e.message, true); } };
          row.append(btn);
        }
        list.append(row);
      }
      $('#history-dialog').showModal();
    } catch (e) { status(e.message, true); }
  };
  const invalidate=()=>{previewId=null;$('#confirm-bulk').hidden=true;$('#bulk-preview').replaceChildren();};
  $('#bulk-tools').onclick=()=>{$('#bulk-error').textContent='';invalidate();$('#bulk-dialog').showModal();};$('#close-bulk').onclick=()=>$('#bulk-dialog').close();$('#bulk-input').oninput=invalidate;
  $('#bulk-file').onchange=async()=>{const file=$('#bulk-file').files[0];if(!file)return;if(file.size>200000){$('#bulk-error').textContent='File limit is200KB.';return;}$('#bulk-input').value=await file.text();invalidate();};
  $('#load-filtered').onclick=()=>{const list=window.PLUSearch.searchItems(items,$('#admin-search').value,'all');if(list.length>100){$('#bulk-error').textContent='Narrow the search to100 items or fewer first.';return;}$('#bulk-input').value=JSON.stringify(list.map(i=>Object.fromEntries(['id','revision','name','plu','cat','code_type','organic','storage','locations','sale_unit','aliases'].map(k=>[k,i[k]]))),null,2);invalidate();};
  $('#apply-bulk-tags').onclick=()=>{try{const rows=parseImport($('#bulk-input').value);for(const row of rows)for(const select of $('#bulk-tag-fields').querySelectorAll('select'))if(select.value)row[select.name]=select.value==='__clear'?'':select.value;$('#bulk-input').value=JSON.stringify(rows,null,2);invalidate();}catch(e){$('#bulk-error').textContent=e.message;}};
  $('#preview-bulk').onclick=async()=>{invalidate();$('#bulk-error').textContent='';$('#preview-bulk').disabled=true;try{const source=$('#bulk-input').value,rows=parseImport(source),p=await request(`${adminPath}/bulk/preview`,{method:'POST',data:{rows}});if($('#bulk-input').value!==source){$('#bulk-error').textContent='Input changed. Preview again.';return;}previewId=p.previewId;
    const heading=document.createElement('p');heading.textContent=`${p.rows.length} proposed changes. Nothing is saved yet. Review before confirming.`;$('#bulk-preview').append(heading);
    for(const row of p.rows){const section=document.createElement('article');section.className='audit-entry';const title=document.createElement('strong');title.textContent=`${row.action.toUpperCase()} · ${row.after.plu} · ${row.after.name}`;const details=document.createElement('pre');const changes={};for(const key of ['name','plu','cat','code_type','organic','storage','locations','sale_unit','aliases'])if(JSON.stringify(row.before?.[key])!==JSON.stringify(row.after[key]))changes[key]={before:row.before?.[key]??null,after:row.after[key]};details.textContent=JSON.stringify(changes,null,2);section.append(title,details);$('#bulk-preview').append(section);}$('#confirm-bulk').hidden=false;
   }catch(e){$('#bulk-error').textContent=e.details?e.details.map(x=>`Row${x.row}: ${x.error}`).join(' · '):e.message;}finally{$('#preview-bulk').disabled=false;}};
  $('#confirm-bulk').onclick=async()=>{if(!previewId)return;$('#confirm-bulk').disabled=true;try{const r=await request(`${adminPath}/bulk/confirm`,{method:'POST',data:{previewId}});invalidate();$('#bulk-dialog').close();await refresh();onChange();status(`${r.count} changes saved. Each can be undone from Activity while unchanged.`);}catch(e){$('#bulk-error').textContent=e.message;invalidate();}finally{$('#confirm-bulk').disabled=false;}};
  const ready = refresh().catch(e => status(e.message, true));
  return { ready, refresh };
}

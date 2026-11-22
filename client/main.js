import JsBarcode from 'jsbarcode';
import { setupAppUpdates } from './app-updates';
import '../public/js/search.js';
import { native, mobileBrowser, request, me, login, mediaURL } from './api';
import { mountEditor } from './editor';
import {createBackHandler,createViewHistory} from './navigation';
import {barcodeSpec,CODE_TYPES} from '../shared/codes';
import { CATEGORIES, TAGS, tagLabels } from '../shared/catalog';
import { similarItems, screenAwake } from './lookup-tools';
const $ = s => document.querySelector(s);
const page = document.body.dataset.page;
const labels = CATEGORIES;
function showError(el, text) { el.textContent = text; el.classList.add('bad'); }

if (page === 'login') {
  const form = $('#login-form');
  form.onsubmit = async e => {
    e.preventDefault(); const button = form.querySelector('button'); button.disabled = true; $('#login-error').textContent = '';
    try { await login(form.elements.username.value.trim(), form.elements.password.value); form.elements.password.value = ''; location.href = '/edit'; }
    catch (err) { showError($('#login-error'), err.message); } finally { button.disabled = false; }
  };
} else if (page === 'admin') {
  me().then(x => { if (!x.authenticated) location.href = '/login.html'; else mountEditor($('#desktop-editor')); }).catch(() => { location.href = '/login.html'; });
} else {
  let items = [], category = 'all', favoritesOnly = false, lastSync = null, offline = false, recent = [], currentDetail = null;
  try { recent = JSON.parse(localStorage.getItem('plu:recent:v1') || '[]'); if(!Array.isArray(recent))recent=[]; } catch {}
  let favorites;
  try { favorites = new Set(JSON.parse(localStorage.getItem('plu:favorites:v2') || '[]')); } catch { favorites = new Set(); }
  const safeStore = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  $('#desktop-admin').hidden = native || mobileBrowser; $('#android-download').hidden = native;
  $('#app-editor-button').hidden = !native;
  $('#native-nav').hidden = !native;
  const viewHistory=createViewHistory();let editorRequest=0,openingEditor=false,loginRequest=0;
  const editorRoot = $('#native-editor'); let editor;
  function barcode(svg, item, large = false) {
    try { const spec=barcodeSpec(item);JsBarcode(svg, spec.value, { format: spec.format, width: large ? 2.2 : 1.35, height: large ? 85 : 42, fontSize: large ? 20 : 11, margin: 8, background: '#fff', lineColor: '#132922', displayValue: true }); }
    catch { svg.replaceWith(document.createTextNode(`Code ${item.plu}`)); }
  }
  function freshness(failed = false) {
    offline=failed;const stamp=lastSync?new Date(lastSync).toLocaleString():null;
    $('#sync-status').textContent = `${failed?'Offline · saved catalogue':'Synced'}${stamp?' · '+stamp:' · no saved copy'}`;
    $('#sync-status').title=stamp?`Last successful refresh: ${stamp} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`:'No successful refresh yet';
    $('#sync-status').classList.toggle('offline', failed);
  }
  for(const key of Object.keys(TAGS)){
    const label=document.createElement('label');label.textContent=({organic:'Growing method',storage:'Storage',locations:'Display location',sale_unit:'Sold by'})[key];const select=document.createElement('select');select.dataset.tag=key;select.setAttribute('aria-label',label.textContent);select.add(new Option('All',''));for(const [value,text]of Object.entries(TAGS[key]))select.add(new Option(text,value));select.onchange=render;label.append(select);$('#tag-filters').append(label);
  }
  $('#clear-filters').onclick=()=>{for(const s of document.querySelectorAll('[data-tag]'))s.value='';render();};
  try{$('#checkout-mode').checked=JSON.parse(localStorage.getItem('plu:checkout:v1')||'false')===true;}catch{}
  const checkout=()=>{document.body.classList.toggle('checkout-view',$('#checkout-mode').checked);safeStore('plu:checkout:v1',$('#checkout-mode').checked);};$('#checkout-mode').onchange=checkout;checkout();
  function quick(){
    for(const [ids,parent,section]of [[Array.from(favorites),'#pinned-items','#pinned-section'],[recent,'#recent-items','#recent-section']]){
      const root=$(parent);root.replaceChildren();for(const id of ids.slice(0,12)){const item=items.find(x=>x.id===id);if(!item)continue;const b=document.createElement('button');b.className='quick-item';b.textContent=`${item.plu} · ${item.name}`;b.onclick=()=>openDetail(item);root.append(b);}$(section).hidden=!root.children.length;
    }
  }
  $('#clear-recent').onclick=()=>{recent=[];safeStore('plu:recent:v1',recent);quick();};
  function openDetail(item){
    currentDetail=item;recent=[item.id,...recent.filter(x=>x!==item.id)].slice(0,12);safeStore('plu:recent:v1',recent);quick();
    $('#detail-name').textContent=item.name;$('#detail-plu').textContent=item.plu;$('#detail-plu').classList.toggle('code-long',item.plu.length>8);$('#detail-format').textContent=CODE_TYPES[item.code_type||'plu']||'Code';$('#detail-tags').textContent=tagLabels(item).join(' · ')||'Tags not set';
    const target=$('#detail-barcode');target.replaceChildren();const big=document.createElementNS('http://www.w3.org/2000/svg','svg');target.append(big);barcode(big,item,true);big.style.width=$('#barcode-size').value+'%';
    const similar=similarItems(item,items);const list=$('#similar-items');list.replaceChildren();for(const other of similar){const b=document.createElement('button');b.className='quick-item';b.textContent=`${other.name} · ${other.plu}${tagLabels(other).length?' · '+tagLabels(other).join(', '):''}`;b.onclick=()=>openDetail(other);list.append(b);}$('#similar-section').hidden=!similar.length;
    if(!$('#detail-dialog').open)$('#detail-dialog').showModal();
  }
  $('#barcode-size').oninput=()=>{const svg=$('#detail-barcode svg');if(svg)svg.style.width=$('#barcode-size').value+'%';};
  $('#keep-awake').onchange=async()=>{try{const active=await screenAwake($('#keep-awake').checked);$('#awake-status').textContent=active?'Screen awake while this code is open.':'';}catch(e){$('#keep-awake').checked=false;$('#awake-status').textContent=e.message;}};
  $('#detail-dialog').addEventListener('close',()=>{$('#keep-awake').checked=false;$('#awake-status').textContent='';screenAwake(false).catch(()=>{});});
  function render() {
    const query = $('#search').value.trim().toLowerCase();
    const filtered = window.PLUSearch.searchItems(items, query, category).filter(i => (!favoritesOnly || favorites.has(i.id)) && [...document.querySelectorAll('[data-tag]')].every(s=>!s.value||(s.dataset.tag==='locations'?(i.locations||[]).includes(s.value):i[s.dataset.tag]===s.value)));
    quick();
    $('#count').textContent = `${filtered.length} ${filtered.length === 1 ? 'item' : 'items'}`;
    const grid = $('#grid'); grid.replaceChildren(); $('#empty').hidden = filtered.length > 0;
    for (const item of filtered) {
      const card = document.createElement('article'); card.className = 'produce-card';
      const top = document.createElement('div'); top.className = 'card-top';
      const chip = document.createElement('span'); chip.className = `category-chip ${item.cat}`; chip.textContent = labels[item.cat] || item.cat;
      const favorite = document.createElement('button'); favorite.className = 'favorite'; favorite.textContent = favorites.has(item.id) ? '★' : '☆'; favorite.setAttribute('aria-label', `${favorites.has(item.id) ? 'Unfavorite' : 'Favorite'} ${item.name}`); favorite.setAttribute('aria-pressed', String(favorites.has(item.id)));
      favorite.onclick = () => { if (favorites.has(item.id)) favorites.delete(item.id); else favorites.add(item.id); safeStore('plu:favorites:v2', [...favorites]); render(); };
      top.append(chip, favorite);
      const name = document.createElement('h2'); name.textContent = item.name;
      const plu = document.createElement('p'); plu.className = 'plu-number'+(item.plu.length>8?' code-long':''); plu.textContent = item.plu;
      const open = document.createElement('button'); open.className = 'barcode-button'; open.setAttribute('aria-label', `Show larger barcode for ${item.name}`);
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); open.append(svg); barcode(svg, item);
      open.onclick = () => openDetail(item);
      const tags=document.createElement('p');tags.className='item-tags';tags.textContent=tagLabels(item).join(' · ');
      card.append(top);
      const photo=mediaURL(item.photo);if(photo){const img=document.createElement('img');img.className='product-photo';img.src=photo;img.alt=item.name;img.loading='lazy';img.onerror=()=>{img.hidden=true;};card.append(img);}
      card.append(name, tags, plu, open); grid.append(card);
    }
  }
  async function refresh() {
    try { const data = await request('/api/items'); if (!Array.isArray(data)) throw new Error('Invalid catalog'); items = data; lastSync = Date.now(); safeStore('plu:catalog:v2', { items, lastSync }); $('#empty').textContent = 'No matching produce. Try a name or a four/five-digit code.'; freshness(false); render(); }
    catch {
      if (!items.length) { try { const cached = JSON.parse(localStorage.getItem('plu:catalog:v2') || '{}'); items = Array.isArray(cached.items) ? cached.items : []; lastSync = cached.lastSync; } catch {} }
      freshness(true); render(); if (!items.length) $('#empty').textContent = 'Could not load the catalog. Check your connection and try Refresh.';
    }
  }
  $('#close-detail').onclick = () => $('#detail-dialog').close();
  $('#refresh').onclick = refresh; $('#search').oninput = render;
  $('#clear-search').onclick = () => { $('#search').value = ''; $('#search').focus(); render(); };
  for (const btn of document.querySelectorAll('[data-cat]')) btn.onclick = () => { category = btn.dataset.cat; for (const b of document.querySelectorAll('[data-cat]')) b.setAttribute('aria-pressed', String(b === btn)); render(); };
  function browse(favs = false, remember=true) { if(remember)viewHistory.visit(favs?'favorites':'browse');favoritesOnly = favs; $('#reader').hidden = false; editorRoot.hidden = true; $('#favorites-toggle').setAttribute('aria-pressed', String(favs)); render(); }
  $('#favorites-toggle').onclick = () => browse(!favoritesOnly);
  $('#nav-browse').onclick = () => browse(); $('#nav-favorites').onclick = () => browse(true);
  async function openEditor() {
    if (!native) return;
    const requestId=++editorRequest;openingEditor=true;
    let user; try { user = await me(); } catch { user = { authenticated: false }; }
    if(requestId!==editorRequest)return;openingEditor=false;
    if (!user.authenticated) { $('#native-login-error').textContent = ''; $('#native-login').showModal(); return; }
    viewHistory.visit('editor');$('#reader').hidden = true; editorRoot.hidden = false;
    if (!editor) editor = mountEditor(editorRoot, { onChange: refresh, onLogout: () => { editor = null; editorRoot.replaceChildren(); viewHistory.reset();browse(false,false); } });
    else editor.refresh();
  }
  $('#app-editor-button').onclick = openEditor; $('#nav-edit').onclick = openEditor;
  $('#close-native-login').onclick = () => {loginRequest++;$('#native-login').close();};
  $('#native-login').addEventListener('cancel',()=>{loginRequest++;});
  $('#native-login').addEventListener('close',()=>{loginRequest++;$('#native-login-form').elements.password.value='';});
  if(native)window.pluHandleBack=createBackHandler({document,
    cancelPending:()=>{if(!openingEditor)return false;editorRequest++;openingEditor=false;return true;},
    closeUpdates:()=>{const panel=$('#app-update-panel');if(panel.hidden)return false;panel.hidden=true;panel.dataset.dismissed='true';window.scrollTo(0,Number(panel.dataset.backScroll)||0);return true;},
    popView:()=>{const previous=viewHistory.back();if(!previous)return false;if(previous==='editor'&&editor){$('#reader').hidden=true;editorRoot.hidden=false;}else browse(previous==='favorites',false);return true;},
    resetFilters:()=>{if(!$('#search').value&&category==='all'&&![...document.querySelectorAll('[data-tag]')].some(s=>s.value))return false;$('#search').value='';category='all';for(const b of document.querySelectorAll('[data-cat]'))b.setAttribute('aria-pressed',String(b.dataset.cat==='all'));for(const s of document.querySelectorAll('[data-tag]'))s.value='';render();return true;}
  });
  $('#native-login-form').onsubmit = async e => {
    e.preventDefault(); const attempt=++loginRequest;const f = e.target; const submit = f.querySelector('[type=submit]'); submit.disabled = true;
    try { await login(f.elements.username.value.trim(), f.elements.password.value); f.elements.password.value = ''; if(attempt!==loginRequest)return;$('#native-login').close(); await openEditor(); }
    catch (err) { showError($('#native-login-error'), err.message); } finally { submit.disabled = false; }
  };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); else { $('#keep-awake').checked=false;screenAwake(false).catch(()=>{});$('#awake-status').textContent=''; } });
  window.addEventListener('online', refresh); window.addEventListener('focus', refresh);
  setInterval(() => { if (!document.hidden) refresh(); }, 30000);
  if (!native && typeof EventSource !== 'undefined') {
    const events = new EventSource('/api/events'); let timer;
    events.addEventListener('catalog', () => { clearTimeout(timer); timer = setTimeout(refresh, 150); });
    window.addEventListener('pagehide', () => events.close(), { once: true });
  }
  try { const cached = JSON.parse(localStorage.getItem('plu:catalog:v2') || '{}'); if (Array.isArray(cached.items)) { items = cached.items; lastSync = cached.lastSync; render(); freshness(true);$('#sync-status').textContent+=' · checking for updates'; } } catch {}
  refresh();
}

if(page==='reader')setupAppUpdates();

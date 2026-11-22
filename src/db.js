const path=require('node:path'),fs=require('node:fs'),Database=require('better-sqlite3');
const {validateItem}=require('../shared/catalog');
const schema=name=>`CREATE TABLE ${name} (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,es TEXT NOT NULL DEFAULT '',plu TEXT NOT NULL UNIQUE,cat TEXT NOT NULL CHECK(cat IN ('fruit','veg','herbs','dry')),created_at TEXT NOT NULL DEFAULT(datetime('now')),revision INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL DEFAULT '',organic TEXT NOT NULL DEFAULT '',storage TEXT NOT NULL DEFAULT '',locations TEXT NOT NULL DEFAULT '[]',sale_unit TEXT NOT NULL DEFAULT '',aliases TEXT NOT NULL DEFAULT '[]',photo TEXT NOT NULL DEFAULT '',code_type TEXT NOT NULL DEFAULT 'plu')`;
const extra={organic:'',storage:'',locations:[],sale_unit:'',aliases:[],photo:'',code_type:'plu'};
const business=['name','es','plu','cat','organic','storage','locations','sale_unit','aliases','photo','code_type'];
const decode=row=>row?{...row,locations:JSON.parse(row.locations||'[]'),aliases:JSON.parse(row.aliases||'[]')}:undefined;
function createStore(filename=process.env.PLU_DB_PATH||path.join(__dirname,'..','data','plu.db')){
 if(filename!==':memory:')fs.mkdirSync(path.dirname(filename),{recursive:true});const db=new Database(filename);db.pragma('journal_mode=WAL');db.pragma('foreign_keys=ON');db.pragma('busy_timeout=5000');let migrated=false;
 db.transaction(()=>{
  const old=db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='items'").get();
  if(!old)db.exec(schema('items'));
  else {
   const columns=db.prepare('PRAGMA table_info(items)').all().map(x=>x.name),target=['id','name','es','plu','cat','created_at','revision','updated_at',...Object.keys(extra)];
   if(columns.some(x=>!target.includes(x)))throw Error('Unknown item columns; migration requires review');
   if(old.sql.includes("'herbs'")&&!columns.includes('code_type')){db.exec("ALTER TABLE items ADD COLUMN code_type TEXT NOT NULL DEFAULT 'plu'");columns.push('code_type');migrated=true;}
   if(!old.sql.includes("'herbs'")||target.some(x=>!columns.includes(x))){
    for(const t of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all())if(db.prepare(`PRAGMA foreign_key_list("${t.name.replace(/"/g,'""')}")`).all().some(x=>x.table==='items'))throw Error('External item references require migration review');
    const seq=db.prepare("SELECT seq FROM sqlite_sequence WHERE name='items'").get()?.seq||0;
    db.exec(schema('items_next'));const defaults={revision:'1',updated_at:"''",organic:"''",storage:"''",locations:"'[]'",sale_unit:"''",aliases:"'[]'",photo:"''",code_type:"'plu'"};
    db.exec(`INSERT INTO items_next(${target.join(',')}) SELECT ${target.map(x=>columns.includes(x)?x:defaults[x]).join(',')} FROM items;DROP TABLE items;ALTER TABLE items_next RENAME TO items;`);
    const now=db.prepare("SELECT seq FROM sqlite_sequence WHERE name='items'").get();if(now)db.prepare("UPDATE sqlite_sequence SET seq=? WHERE name='items'").run(Math.max(seq,now.seq));else db.prepare('INSERT INTO sqlite_sequence(name,seq) VALUES(?,?)').run('items',seq);migrated=true;
   }
  }
  db.exec(`CREATE INDEX IF NOT EXISTS idx_items_cat ON items(cat);CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);
   CREATE TABLE IF NOT EXISTS catalog_meta(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL);INSERT OR IGNORE INTO catalog_meta VALUES(1,1);
   CREATE TABLE IF NOT EXISTS item_audit(id INTEGER PRIMARY KEY,action TEXT NOT NULL,item_id INTEGER NOT NULL,actor TEXT NOT NULL,before_json TEXT,after_json TEXT,created_at TEXT NOT NULL DEFAULT(datetime('now')),undone_by INTEGER);
   CREATE TABLE IF NOT EXISTS app_sessions(token_hash TEXT PRIMARY KEY,expires_at INTEGER NOT NULL);`);
  if(!db.prepare('PRAGMA table_info(item_audit)').all().some(x=>x.name==='undone_by'))db.exec('ALTER TABLE item_audit ADD COLUMN undone_by INTEGER');
  if(migrated)db.exec('UPDATE catalog_meta SET revision=revision+1 WHERE id=1');
 }).immediate();
 const getItemById=id=>decode(db.prepare('SELECT * FROM items WHERE id=?').get(id)),getItemByPlu=plu=>decode(db.prepare('SELECT * FROM items WHERE plu=?').get(plu));
 function audit(action,id,actor,before,after){const n=db.prepare('INSERT INTO item_audit(action,item_id,actor,before_json,after_json) VALUES(?,?,?,?,?)').run(action,id,actor,before?JSON.stringify(before):null,after?JSON.stringify(after):null);db.exec('UPDATE catalog_meta SET revision=revision+1 WHERE id=1');return Number(n.lastInsertRowid);}
 const sqlValue=(key,x)=>['locations','aliases'].includes(key)?JSON.stringify(x||[]):x;
 function write(id,item){const merged={...extra,...getItemById(id),...item};db.prepare(`UPDATE items SET ${business.map(k=>k+'=?').join(',')},revision=revision+1,updated_at=datetime('now') WHERE id=?`).run(...business.map(k=>sqlValue(k,merged[k]??'')),id);return getItemById(id);}
 const createItem=db.transaction((item,actor='web-admin')=>{const v={es:'',...extra,...item};const n=db.prepare(`INSERT INTO items(${business.join(',')},updated_at) VALUES(${business.map(()=>'?').join(',')},datetime('now'))`).run(...business.map(k=>sqlValue(k,v[k])));const after=getItemById(n.lastInsertRowid);audit('create',after.id,actor,null,after);return after;});
 const updateItem=db.transaction((id,item,revision,actor='web-admin',action='update')=>{const before=getItemById(id);if(!before)return{error:'not_found'};if(revision!==undefined&&revision!==before.revision)return{error:'conflict',current:before};const after=write(id,item);audit(action,id,actor,before,after);return{item:after};});
 const deleteItem=db.transaction((id,revision,actor='web-admin')=>{const before=getItemById(id);if(!before)return{error:'not_found'};if(revision!==undefined&&revision!==before.revision)return{error:'conflict',current:before};db.prepare('DELETE FROM items WHERE id=?').run(id);audit('delete',id,actor,before,null);return{item:before};});
 const same=(a,b)=>a&&b&&a.revision===b.revision&&business.every(k=>JSON.stringify(a[k]??extra[k]??'')===JSON.stringify(b[k]??extra[k]??''));
 const undoItem=db.transaction((auditId,actor='web-admin',deleteOnly=false)=>{
  const entry=db.prepare('SELECT * FROM item_audit WHERE id=?').get(auditId);if(!entry)return{error:'not_found'};
  if(entry.undone_by||!['create','update','photo','delete'].includes(entry.action)||(deleteOnly&&entry.action!=='delete'))return{error:'conflict'};
  const before=entry.before_json?JSON.parse(entry.before_json):null,after=entry.after_json?JSON.parse(entry.after_json):null,current=getItemById(entry.item_id);let restored=null;
  if(entry.action==='delete'){
   if(current||getItemByPlu(before.plu))return{error:'conflict'};const v={...extra,...before};
   db.prepare(`INSERT INTO items(id,${business.join(',')},revision,created_at,updated_at) VALUES(?,${business.map(()=>'?').join(',')},?,?,datetime('now'))`).run(v.id,...business.map(k=>sqlValue(k,v[k]??'')),v.revision+1,v.created_at||new Date().toISOString());restored=getItemById(v.id);
  }else{
   if(!same(current,after))return{error:'conflict',current};
   if(entry.action==='create')db.prepare('DELETE FROM items WHERE id=?').run(current.id);
   else{const duplicate=getItemByPlu(before.plu);if(duplicate&&duplicate.id!==current.id)return{error:'conflict'};restored=write(current.id,{...extra,...before});}
  }
  const undo=audit('undo_'+entry.action,entry.item_id,actor,current,restored);db.prepare('UPDATE item_audit SET undone_by=? WHERE id=?').run(undo,auditId);return{item:restored,ok:true};
 });
 const seedItems=db.transaction(rows=>{const insert=db.prepare('INSERT OR IGNORE INTO items(name,es,plu,cat) VALUES(?,?,?,?)');for(const i of rows)insert.run(i.name,i.es||'',String(i.plu),i.cat);return db.prepare('SELECT count(*) n FROM items').get().n;});
 function previewBulk(rows){
  if(!Array.isArray(rows)||!rows.length||rows.length>100)return{errors:[{row:0,error:'Use1–100 rows.'}],rows:[]};
  const result=[],errors=[],seen=new Set(),ids=new Set();
  rows.forEach((raw,index)=>{const fail=error=>errors.push({row:index+1,error});const known=raw&&typeof raw==='object'?(raw.id===undefined?getItemByPlu(String(raw.plu??'')):Number.isSafeInteger(raw.id)?getItemById(raw.id):null):null;const item=validateItem(raw&&typeof raw==='object'?{...raw,code_type:raw.code_type??(known?.plu===String(raw.plu)?known.code_type:undefined)}:raw);if(item.error)return fail(item.error);
   if(seen.has(item.plu))return fail('Duplicate PLU inside import.');seen.add(item.plu);
   if(raw.id!==undefined&&(!Number.isSafeInteger(raw.id)||raw.id<1))return fail('Invalid item ID.');
   const current=raw.id===undefined?getItemByPlu(item.plu):getItemById(raw.id);
   if(raw.id!==undefined&&!current)return fail('Item ID does not exist.');
   if(current&&ids.has(current.id))return fail('Same item appears twice.');if(current)ids.add(current.id);
   if(raw.revision!==undefined&&(!Number.isInteger(raw.revision)||raw.revision!==current?.revision))return fail('Stale or invalid revision.');
   const dup=getItemByPlu(item.plu);if(dup&&dup.id!==current?.id)return fail('PLU belongs to another item.');
   result.push({action:current?'update':'create',id:current?.id||null,revision:current?.revision||null,before:current||null,after:{...extra,...current,...item}});
  });return{rows:result,errors};
 }
 const applyBulk=db.transaction((plan,baseRevision,actor)=>{
  if(db.prepare('SELECT revision FROM catalog_meta WHERE id=1').get().revision!==baseRevision)return{error:'conflict'};
  for(const row of plan){if(row.action==='create')createItem(row.after,actor);else{const r=updateItem(row.id,row.after,row.revision,actor);if(r.error)throw Error('Bulk revision changed');}}return{ok:true,count:plan.length};
 });
 return {db,createItem,updateItem,deleteItem,undoItem,restoreItem:(id,actor)=>undoItem(id,actor,true),seedItems,getItemById,getItemByPlu,previewBulk,applyBulk,
  listItems:()=>db.prepare("SELECT id,name,plu,cat,revision,COALESCE(NULLIF(updated_at,''),created_at) AS updated_at,organic,storage,locations,sale_unit,aliases,photo,code_type FROM items ORDER BY name COLLATE NOCASE").all().map(decode),
  countItems:()=>db.prepare('SELECT count(*) n FROM items').get().n,revision:()=>db.prepare('SELECT revision FROM catalog_meta WHERE id=1').get().revision,
  listAudit:()=>db.prepare('SELECT * FROM item_audit ORDER BY id DESC LIMIT 40').all(),close:()=>db.close()};
}
let defaultStore;module.exports={createStore};for(const k of ['db','seedItems','getItemById','getItemByPlu','createItem','deleteItem','countItems','listItems'])Object.defineProperty(module.exports,k,{get(){defaultStore||=createStore();return defaultStore[k];}});

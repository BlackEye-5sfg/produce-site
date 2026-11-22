const {validateCode}=require('./codes');
// Shared validation vocabulary. Unspecified tags are deliberately unknown, not guessed.
const CATEGORIES = { veg: 'Vegetables', fruit: 'Fruit', herbs: 'Herbs', dry: 'Pantry' };
const TAGS = {
  organic: { organic: 'Organic', conventional: 'Normal / conventional' },
  storage: { cooler: 'Cooler', ambient: 'Ambient' },
  locations: { table: 'Table', wet_wall: 'Wet wall', bunker: 'Bunker', counter: 'Counter' },
  sale_unit: { weight: 'By weight', each: 'Each' }
};
function validateItem(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Invalid item.' };
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const plu = typeof body.plu==='string'?body.plu.trim():(typeof body.plu==='number'&&/^\d{4,5}$/.test(String(body.plu))?String(body.plu):body.plu), cat = String(body.cat || '').toLowerCase();
  if (!name || name.length > 120 || /[\x00-\x1f]/.test(name)) return { error: 'Enter a name of 1 to 120 characters without control characters.' };
  const code=validateCode(plu,body.code_type);if(code.error)return{error:code.error};
  if (!Object.hasOwn(CATEGORIES,cat)) return { error: 'Choose Vegetables, Fruit, Herbs or Pantry.' };
  const item = { name, plu:code.value, cat, code_type:code.type };
  for (const key of ['organic','storage','sale_unit']) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== 'string' || (body[key] !== '' && !Object.hasOwn(TAGS[key],body[key]))) return { error: `Invalid ${key} tag.` };
    item[key] = body[key];
  }
  if (body.locations !== undefined) {
    if (!Array.isArray(body.locations) || body.locations.length > 4 || body.locations.some(x => typeof x !== 'string' || !Object.hasOwn(TAGS.locations,x))) return { error: 'Choose valid display locations.' };
    item.locations = [...new Set(body.locations)];
  }
  if (body.aliases !== undefined) {
    if (!Array.isArray(body.aliases) || body.aliases.length > 12 || body.aliases.some(x => typeof x !== 'string' || !x.trim() || x.trim().length > 40 || /[\x00-\x1f]/.test(x))) return { error: 'Use up to12 aliases, each1–40 characters.' };
    item.aliases = [...new Set(body.aliases.map(x => x.trim()))];
  }
  return item;
}
function csvRows(text) {
  const rows=[];let row=[],value='',quoted=false;
  for(let i=0;i<=text.length;i++) {
    const c=text[i];
    if(quoted) { if(c===undefined) throw Error('Unclosed CSV quote.');if(c==='"'&&text[i+1]==='"'){value+='"';i++;}else if(c==='"')quoted=false;else value+=c; }
    else if(c==='"'&&!value)quoted=true;
    else if(c===','||c==='\n'||c===undefined){row.push(value);value='';if(c!==','){if(row.some(x=>x.trim()))rows.push(row);row=[];}}
    else if(c!=='\r')value+=c;
  }
  return rows;
}
function parseImport(text) {
  if(typeof text!=='string'||text.length>200000)throw Error('Import is limited to200KB and100 rows.');
  text=text.replace(/^\uFEFF/,'').trim();let rows;
  if(text.startsWith('['))rows=JSON.parse(text);
  else {
    const csv=csvRows(text),headers=(csv.shift()||[]).map(x=>x.trim().toLowerCase());
    const allowed=['id','revision','name','plu','cat','code_type','organic','storage','locations','sale_unit','aliases'];
    if(!['name','plu','cat'].every(x=>headers.includes(x))||new Set(headers).size!==headers.length||headers.some(x=>!allowed.includes(x)))throw Error('CSV needs name,plu,cat; optional id,revision,code_type,organic,storage,locations,sale_unit,aliases.');
    rows=csv.map((values,index)=>{if(values.length!==headers.length)throw Error(`CSV row${index+2} has the wrong column count.`);const row=Object.fromEntries(headers.map((h,i)=>[h,values[i].trim()]));
      for(const k of ['id','revision']){if(row[k])row[k]=Number(row[k]);else delete row[k];}
      for(const k of ['locations','aliases'])if(row[k]!==undefined)row[k]=row[k]?row[k].split('|').map(x=>x.trim()).filter(Boolean):[];
      row.cat=({vegetables:'veg',vegetable:'veg',fruit:'fruit',herbs:'herbs',pantry:'dry'})[row.cat.toLowerCase()]||row.cat.toLowerCase();return row;});
  }
  if(!Array.isArray(rows)||!rows.length||rows.length>100)throw Error('Use1–100 rows per preview.');return rows;
}
function tagLabels(item) {
  return [TAGS.organic[item.organic],TAGS.storage[item.storage],...(item.locations||[]).map(x=>TAGS.locations[x]),TAGS.sale_unit[item.sale_unit]].filter(Boolean);
}
module.exports = { CATEGORIES, TAGS, validateItem, parseImport, tagLabels };

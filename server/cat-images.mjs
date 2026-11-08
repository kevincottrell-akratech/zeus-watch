import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const PACK_DIR=resolve(import.meta.dirname,'../fixtures/synthetic/showcase/cat-image-pack');
const CATS_FILE=resolve(import.meta.dirname,'../fixtures/synthetic/showcase/cats.json');
const validViews=new Set(['front','side','rear']);
const imagePathPattern=/^images\/K\d{3}_(front|side|rear)\.png$/;

export const CAT_IMAGE_MANIFEST=JSON.parse(readFileSync(resolve(PACK_DIR,'manifest.json'),'utf8'));
const showcaseCats=JSON.parse(readFileSync(CATS_FILE,'utf8'));
const showcaseCatIds=new Set(showcaseCats.filter(cat=>cat.synthetic===true).map(cat=>cat.id));
const entriesByCat=new Map();
const seen=new Set();

if(!Array.isArray(CAT_IMAGE_MANIFEST)||CAT_IMAGE_MANIFEST.length!==26)throw Error('Showcase cat image manifest must contain exactly 26 entries.');
for(const entry of CAT_IMAGE_MANIFEST){
 if(!entry||typeof entry.cat_id!=='string'||!showcaseCatIds.has(entry.cat_id))throw Error('Cat image manifest references an unknown showcase cat ID.');
 if(!validViews.has(entry.view)||!imagePathPattern.test(entry.file)||!entry.file.endsWith(`_${entry.view}.png`))throw Error('Cat image manifest contains an unsupported view or file path.');
 if(entry.synthetic!==true||entry.provenance_label!=='synthetic_demo'||!/^([a-f0-9]{64})$/.test(entry.sha256))throw Error('Cat image manifest is missing synthetic provenance or a valid SHA-256 hash.');
 const key=`${entry.cat_id}:${entry.view}`;
 if(seen.has(key))throw Error('Cat image manifest contains a duplicate cat view.');
 seen.add(key);
 const views=entriesByCat.get(entry.cat_id)||[];
 views.push(entry);
 entriesByCat.set(entry.cat_id,views);
}
if(entriesByCat.size!==18||[...entriesByCat.values()].some(views=>views.filter(entry=>entry.view==='front').length!==1))throw Error('Cat image manifest must map one front image to each of 18 showcase cats.');

const viewOrder={front:0,side:1,rear:2};
export function catImageEntry(catId,view){return entriesByCat.get(catId)?.find(entry=>entry.view===view)||null;}
export function catImageViews(catId){
 return (entriesByCat.get(catId)||[]).slice().sort((a,b)=>viewOrder[a.view]-viewOrder[b.view]).map(entry=>({
  view:entry.view,
  url:`/api/v1/cat-images/${encodeURIComponent(entry.cat_id)}/${entry.view}`,
  alt_text:entry.alt_text,
  generated_date:entry.generated_date,
  provenance_label:entry.provenance_label,
  identity_status:entry.identity_status
 }));
}
export function catImagePrimary(catId){return catImageViews(catId).find(image=>image.view==='front')||null;}
export function ensureCatMediaTable(db){
 db.exec(`CREATE TABLE IF NOT EXISTS cat_media(
  cat_id TEXT NOT NULL,
  view TEXT NOT NULL CHECK(view IN ('front','side','rear')),
  metadata TEXT NOT NULL,
  original BLOB NOT NULL,
  derivative BLOB NOT NULL,
  PRIMARY KEY(cat_id,view)
 );`);
}

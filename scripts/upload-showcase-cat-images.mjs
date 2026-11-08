import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdirSync,existsSync,readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {basename,dirname,resolve} from 'node:path';
import {inspectImage} from '../server/images.mjs';
import {CAT_IMAGE_MANIFEST,ensureCatMediaTable} from '../server/cat-images.mjs';

const ROOT=resolve(import.meta.dirname,'..');
const ZIP=resolve(process.argv[2]||resolve(ROOT,'attached_assets/Zeus_Watch_Synthetic_Cat_Images_v1_1794094577968.zip'));
const DB_PATH=process.env.DATABASE_PATH||resolve(ROOT,'data/zeus.sqlite');
if(!existsSync(ZIP))throw Error(`Image pack not found: ${ZIP}`);
const cats=JSON.parse(readFileSync(resolve(ROOT,'fixtures/synthetic/showcase/cats.json'),'utf8'));
const catIds=new Set(cats.filter(cat=>cat.synthetic===true).map(cat=>cat.id));
if(CAT_IMAGE_MANIFEST.length!==26||new Set(CAT_IMAGE_MANIFEST.map(entry=>entry.cat_id)).size!==18||CAT_IMAGE_MANIFEST.some(entry=>!catIds.has(entry.cat_id)))throw Error('Image manifest does not map exactly to 18 existing showcase cats.');

if(DB_PATH===':memory:')throw Error('Set DATABASE_PATH to a persistent SQLite file before importing cat images.');
mkdirSync(dirname(resolve(DB_PATH)),{recursive:true});
const db=new DatabaseSync(DB_PATH);
let inserted=0,alreadyPresent=0;
try{
 db.exec('PRAGMA journal_mode=WAL;');
 ensureCatMediaTable(db);
 db.exec('BEGIN IMMEDIATE');
 try{
  const find=db.prepare('SELECT metadata FROM cat_media WHERE cat_id=? AND view=?');
  const insert=db.prepare('INSERT INTO cat_media(cat_id,view,metadata,original,derivative) VALUES(?,?,?,?,?)');
  for(const entry of CAT_IMAGE_MANIFEST){
   const prior=find.get(entry.cat_id,entry.view);
   if(prior){
    const metadata=JSON.parse(prior.metadata);
    if(metadata.sha256!==entry.sha256)throw Error(`Stored image differs from the manifest for ${entry.alias} ${entry.view}; refusing to overwrite it.`);
    alreadyPresent++;
    continue;
   }
   const original=execFileSync('unzip',['-p',ZIP,entry.file],{maxBuffer:12*1024*1024});
   const sha256=createHash('sha256').update(original).digest('hex');
   if(sha256!==entry.sha256)throw Error(`SHA-256 mismatch for ${entry.file}; no cat images were imported.`);
   const checked=await inspectImage({filename:basename(entry.file),base64:original.toString('base64'),permission_basis:'synthetic_demo'});
   if(checked.sha256!==entry.sha256||checked.width!==entry.width||checked.height!==entry.height||checked.location_evidence.length)throw Error(`Image validation or manifest metadata mismatch for ${entry.file}.`);
   const metadata={
    cat_id:entry.cat_id,
    alias:entry.alias,
    view:entry.view,
    source_file:entry.file,
    sha256:entry.sha256,
    bytes:checked.bytes,
    width:checked.width,
    height:checked.height,
    original_mime:checked.mime,
    derivative_mime:'image/jpeg',
    synthetic:true,
    provenance_label:entry.provenance_label,
    generated_date:entry.generated_date,
    method:entry.method,
    prompt:entry.prompt,
    reference:entry.reference,
    identity_status:entry.identity_status,
    alt_text:entry.alt_text,
    gps_metadata_present:entry.gps_metadata_present,
    exif_tag_count:entry.exif_tag_count,
    metadata_note:checked.metadata_note
   };
   insert.run(entry.cat_id,entry.view,JSON.stringify(metadata),checked.buffer,checked.derivative);
   inserted++;
  }
  db.exec('COMMIT');
 }catch(error){
  db.exec('ROLLBACK');
  throw error;
 }
}finally{
 db.close();
}
console.log(`Showcase cat image import complete: ${inserted} added, ${alreadyPresent} already present, ${new Set(CAT_IMAGE_MANIFEST.map(entry=>entry.cat_id)).size} stable cat IDs.`);

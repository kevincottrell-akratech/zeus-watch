import test from 'node:test';
import assert from 'node:assert/strict';
import * as d from '../server/domain.mjs';

test('manual review options use existing stable records and retain coordinator-only authority',()=>{
 const s=d.seed(),co=d.authUser(s,'co1'),before=JSON.stringify(s);
 const r=s.incoming_updates.find(r=>r.alias==='R01');
 const detail=d.updateDetail(s,co,r.id),options=detail.manual_review_options;
 assert.equal(options.habitats.length,18);
 assert.equal(options.cats.length,108);
 assert.equal(detail.canonical_text,r.canonical_text);
 assert.equal(detail.provenance_label,r.provenance_label);
 assert.ok(options.cats.every(c=>s.cats.some(source=>source.id===c.id&&source.primary_colony_id===c.colony_id)));
 assert.ok(options.cats.every(c=>!('traits' in c)&&!('photo_url' in c)));
 for(const alias of ['v01','admin']){
  const user=d.authUser(s,alias);
  assert.throws(()=>d.manualReviewOptions(s,user),error=>error.status===403);
  assert.throws(()=>d.updateDetail(s,user,r.id),error=>error.status===403);
 }
 assert.equal(JSON.stringify(s),before);
});

test('manual review rejects cross-habitat identities without changing records or source evidence',()=>{
 const s=d.seed(),co=d.authUser(s,'co1'),r=s.incoming_updates[0],cat=s.cats[0];
 const other=s.colonies.find(c=>c.id!==cat.primary_colony_id);
 const before=JSON.stringify(s);
 assert.throws(()=>d.review(s,co,r.id,{expected_version:r.version,decision:'approve',reason:'Reviewed fictional source',observation:{colony_id:other.id,cat_id:cat.id,coverage:'not_count',observed_at:s.clock,time_confirmed:true}}),error=>error.code==='IDENTITY_COLONY_MISMATCH');
 assert.equal(JSON.stringify(s),before);
 d.review(s,co,r.id,{expected_version:r.version,decision:'approve',reason:'Reviewed fictional source and explicitly selected existing cat',observation:{colony_id:cat.primary_colony_id,cat_id:cat.id,coverage:'not_count',observed_at:s.clock,time_confirmed:true}});
 const observation=s.observations.find(o=>o.incoming_update_id===r.id);
 assert.equal(observation.cat_id,cat.id);
 assert.equal(observation.colony_id,cat.primary_colony_id);
 assert.equal(observation.source_assertion,r.canonical_text);
 assert.equal(s.cats.length,108);
});

test('genuine empty choices explain why and never create records',()=>{
 const s=d.seed(),co=d.authUser(s,'co1');
 s.cats=[];
 assert.deepEqual(d.manualReviewOptions(s,co).cats,[]);
 s.colonies=[];
 const before=JSON.stringify(s),options=d.manualReviewOptions(s,co);
 assert.deepEqual(options.habitats,[]);
 assert.equal(options.can_create_identity,false);
 assert.match(options.reason,/No habitats.*pending/);
 assert.equal(JSON.stringify(s),before);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as d from '../server/domain.mjs';
import {parseImport,importText} from '../server/parsers.mjs';
import {explicitInstant,sourceTime,utcReviewValue,reviewInstant,needsTimeConfirmation} from '../server/source-time.mjs';

test('explicit offsets and sub-minute precision survive UTC review regardless of browser/server timezone',()=>{
 const record={source_system:'upload_json',observed_at:'2026-11-07T08:15:27.321-04:00',imported_evidence:{observed_at:'2026-11-07T08:15:27.321-04:00'}};
 const before=structuredClone(record),source=sourceTime(record);
 assert.equal(source.raw,'2026-11-07T08:15:27.321-04:00');
 assert.equal(source.timezone,'UTC-04:00');
 assert.equal(source.instant,'2026-11-07T12:15:27.321Z');
 assert.equal(utcReviewValue(source.instant),'2026-11-07T12:15:27.321');
 assert.equal(reviewInstant(utcReviewValue(source.instant)),source.instant);
 assert.equal(needsTimeConfirmation(record,source.instant),false);
 assert.equal(needsTimeConfirmation(record,'2026-11-07T13:15:27.321Z'),true);
 assert.deepEqual(record,before);
});

test('TXT keeps the original timestamp and declared interpretation; unknown timezone is not replaced',()=>{
 const body={format:'txt',text:'11/7/26, 5:00:23 AM - Volunteer 01: Fictional cats seen.',locale:'en-US',timezone:'UTC',permission_basis:'synthetic_demo'};
 const event=parseImport(body)[0];
 assert.equal(event.source_timestamp_text,'11/7/26, 5:00:23 AM');
 assert.equal(event.source_timezone,'UTC');
 assert.equal(event.observed_at,'2026-11-07T05:00:23.000Z');
 const record={source_system:'upload_txt',imported_evidence:event};
 assert.equal(sourceTime(record).kind,'message');
 assert.equal(needsTimeConfirmation(record,event.observed_at),true);
 const unknown=parseImport({...body,timezone:'unknown'})[0];
 assert.equal(unknown.observed_at,null);
 assert.equal(unknown.source_timezone,null);
 assert.equal(sourceTime({source_system:'upload_txt',imported_evidence:unknown}).status,'ambiguous');
 assert.equal(sourceTime({source_system:'upload_txt',imported_evidence:unknown}).raw,event.source_timestamp_text);
 assert.throws(()=>parseImport({...body,timezone:undefined}),e=>e.code==='LOCALE_REQUIRED');
});

test('missing, offset-free, conflicting and legacy TXT times never fall back to receipt or demo time',()=>{
 const missing={observed_at:d.NOW,received_at:d.NOW,imported_evidence:{observed_at:null}};
 assert.equal(sourceTime(missing).status,'missing');
 assert.equal(sourceTime(missing).instant,null);
 const ambiguous={source_system:'upload_json',imported_evidence:{observed_at:'2026-11-01T01:30:00',timezone:'America/New_York'}};
 assert.equal(sourceTime(ambiguous).status,'ambiguous');
 assert.equal(sourceTime(ambiguous).timezone,'America/New_York');
 assert.equal(utcReviewValue(sourceTime(ambiguous).instant),'');
 const legacy={source_system:'upload_txt',observed_at:'2026-11-07T05:00:00Z',imported_evidence:{observed_at:'2026-11-07T05:00:00Z'}};
 assert.equal(sourceTime(legacy).status,'ambiguous');
 assert.equal(sourceTime(legacy).timezone,null);
 assert.equal(sourceTime(legacy).instant,null);
 assert.match(sourceTime(legacy).raw_label,/interpretation/);
 assert.equal(sourceTime({imported_evidence:{observed_at:'2026-11-07T05:00:00-04:00',timezone:'UTC'}}).status,'ambiguous');
});

test('review timestamps require valid calendar dates and explicit offsets, not Date.parse rollover or host timezone',()=>{
 for(const raw of ['2026-02-30T05:00:00Z','2026-11-07T25:00:00Z','2026-11-07T05:00:00+15:00','2026-11-07T05:00:00','11/7/26 5:00 AM'])assert.equal(explicitInstant(raw),null,raw);
 assert.equal(explicitInstant('2024-02-29T05:00:00Z'),'2024-02-29T05:00:00.000Z');
});

test('manual approval requires explicit confirmation of missing, ambiguous or changed times and preserves source evidence',()=>{
 for(const reported of [null,'2026-11-07T01:30:00','2026-11-07T08:15:00-04:00']){
  const state=d.seed(),user=d.authUser(state,'co2');
  const entry={source_event_id:'time-case',event_type:'message',canonical_text:'Fictional source evidence; identity uncertain.',observed_at:reported};
  const result=importText(state,user,{format:'json',text:JSON.stringify([entry]),permission_basis:'synthetic_demo'});
  assert.equal(result.imported,1);
  const record=state.incoming_updates.at(-1),before=structuredClone(record),beforeState=d.hash(state);
  const review={decision:'approve',expected_version:1,reason:'Reviewer confirmed the UTC observation time from supporting fictional evidence.',observation:{colony_id:state.colonies[0].id,coverage:'not_count',observed_at:'2026-11-07T12:30:00Z'}};
  assert.throws(()=>d.review(state,user,record.id,review),e=>e.code==='TIME_CONFIRMATION_REQUIRED');
  assert.equal(d.hash(state),beforeState);
  assert.throws(()=>d.review(state,d.authUser(state,'v01'),record.id,{...review,observation:{...review.observation,time_confirmed:true}}),e=>e.status===403);
  d.review(state,user,record.id,{...review,observation:{...review.observation,time_confirmed:true}});
  const stored=state.incoming_updates.at(-1);
  for(const key of ['observed_at','imported_evidence','canonical_text','source_file_hash'])assert.deepEqual(stored[key],before[key]);
  assert.equal(state.observations.at(-1).observed_at,'2026-11-07T12:30:00Z');
  assert.equal(state.observations.at(-1).cat_id,null);
  assert.equal(state.reviews.at(-1).time_review.explicitly_confirmed,true);
 }
});

test('an explicit source observation after the frozen demo clock is preserved, not replaced to satisfy the clock',t=>{
 t.mock.method(Date,'now',()=>Date.parse('2026-11-08T12:00:00Z'));
 const state=d.seed(),user=d.authUser(state,'co2'),reported='2026-11-07T19:15:00-04:00';
 importText(state,user,{format:'json',text:JSON.stringify([{source_event_id:'after-demo-clock',event_type:'note',canonical_text:'Fictional observed event after the demo clock.',observed_at:reported}]),permission_basis:'synthetic_demo'});
 const record=state.incoming_updates.at(-1);
 d.review(state,user,record.id,{decision:'approve',expected_version:1,reason:'Reviewed exact timestamp and numeric source offset.',observation:{colony_id:state.colonies[0].id,coverage:'not_count',observed_at:reported}});
 assert.equal(state.observations.at(-1).observed_at,reported);
 assert.equal(record.observed_at,reported);
 assert.equal(state.clock,d.NOW);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {census} from '../server/domain.mjs';

const row=(observed_at,count,extra={})=>({
 colony_id:'fictional-colony',coverage:'complete',observed_at,
 count_min:count,count_max:count,...extra
});
function evaluate(observations,clock='2026-11-07T18:00:00Z'){
 const state={clock,observations},before=structuredClone(state);
 const result=census(state,'fictional-colony');
 assert.deepEqual(state,before,'Census must not reorder records or rewrite source evidence');
 return result;
}

test('10:00-05:00 is later than 12:00Z, regardless of input order',()=>{
 const later=row('2026-11-07T10:00:00-05:00',8);
 const earlier=row('2026-11-07T12:00:00Z',3);
 for(const observations of [[earlier,later],[later,earlier]]){
  assert.deepEqual(evaluate(observations),{
   count_min:8,count_max:8,census_as_of:later.observed_at,freshness:'fresh'
  });
 }
});

test('10:00-05:00 and 15:00Z are the same instant and differing counts conflict',()=>{
 const offset=row('2026-11-07T10:00:00-05:00',8);
 const utc=row('2026-11-07T15:00:00Z',3);
 for(const observations of [[offset,utc],[utc,offset]]){
  const result=evaluate(observations);
  assert.equal(result.freshness,'conflicting');
  assert.equal(result.count_min,null);
  assert.equal(result.count_max,null);
  assert.equal(result.census_as_of,observations[0].observed_at);
 }
 // A disagreement in just one end of a count range must also conflict.
 assert.equal(evaluate([offset,{...utc,count_min:8,count_max:9}]).freshness,'conflicting');
});

test('equivalent timestamps with matching counts agree; milliseconds remain significant',()=>{
 const offset=row('2026-11-07T10:00:00-05:00',8);
 assert.equal(evaluate([offset,row('2026-11-07T15:00:00.000Z',8)]).freshness,'fresh');
 assert.deepEqual(evaluate([offset,row('2026-11-07T15:00:00.001Z',4)]),{
  count_min:4,count_max:4,census_as_of:'2026-11-07T15:00:00.001Z',freshness:'fresh'
 });
 assert.equal(evaluate([offset],'2026-11-14T15:00:00Z').freshness,'fresh');
 assert.equal(evaluate([offset],'2026-11-14T15:00:00.001Z').freshness,'stale');
});

test('ineligible or unresolved observations cannot replace a supported census instant',()=>{
 const supported=row('2026-11-07T10:00:00-05:00',8);
 const ignored=[
  row('2026-11-07T17:00:00Z',2,{coverage:'partial'}),
  row('2026-11-07T17:00:00Z',2,{withdrawn_at:'2026-11-07T17:30:00Z'}),
  row('2026-11-07T17:00:00Z',2,{colony_id:'another-fictional-colony'}),
  row(null,2),row('invalid',2),row('2026-11-07T17:00:00',2)
 ];
 assert.equal(evaluate([...ignored,supported]).count_min,8);
 assert.deepEqual(evaluate(ignored),{count_min:null,count_max:null,census_as_of:null,freshness:'unknown'});
});

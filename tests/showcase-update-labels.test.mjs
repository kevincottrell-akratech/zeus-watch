import test from 'node:test';
import assert from 'node:assert/strict';
import * as d from '../server/domain.mjs';

function showcaseDashboard(state=d.seed('showcase')){
 const coordinator=d.authUser(state,'co1');
 assert.ok(coordinator);
 return {state,updates:d.dashboard(state,coordinator).updates};
}

test('Showcase update labels use each linked habitat and keep source text intact',()=>{
 const {state,updates}=showcaseDashboard();
 const originals=new Map(state.incoming_updates.map(update=>[update.id,structuredClone(update)]));
 assert.equal(updates.length,24);
 for(const update of updates){
  const original=originals.get(update.id);
  const links=state.reviews.filter(review=>review.update_id===original.id);
  assert.equal(links.length,1,original.alias);
  const colony=state.colonies.find(candidate=>candidate.id===links[0].proposed_colony_id);
  const habitat=colony.alias.match(/^C(\d{2})$/)?.[1];
  assert.ok(habitat,original.alias);
  const sourcePrefix=original.canonical_text.match(/^Demo update for habitat (\d{2}):\s*/i);
  if(sourcePrefix)assert.equal(sourcePrefix[1],habitat,original.alias);
  const body=sourcePrefix?original.canonical_text.slice(sourcePrefix[0].length):original.canonical_text;
  assert.equal(update.display_text,`Habitat ${habitat} update: ${body}`,original.alias);
  assert.equal(update.canonical_text,original.canonical_text,original.alias);
  assert.equal(update.habitat_link_review,undefined,original.alias);
 }
 assert.deepEqual(state.incoming_updates.map(update=>update),[...originals.values()]);
});

test('Showcase update labels remain unchanged and visibly flagged when habitat links are ambiguous',()=>{
 const cases=[
  state=>{state.reviews=state.reviews.filter(review=>review.update_id!==state.incoming_updates[0].id);},
  state=>{const review=state.reviews.find(row=>row.update_id===state.incoming_updates[0].id);review.proposed_colony_id=state.colonies[1].id;},
  state=>{state.reviews.push(structuredClone(state.reviews[0]));}
 ];
 for(const alter of cases){
  const state=d.seed('showcase');
  const target=state.incoming_updates[0];
  const original=target.canonical_text;
  alter(state);
  const update=showcaseDashboard(state).updates.find(row=>row.id===target.id);
  assert.equal(update.display_text,original);
  assert.equal(update.canonical_text,original);
  assert.equal(update.habitat_link_review,true);
 }
});

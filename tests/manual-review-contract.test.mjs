import test from 'node:test';
import assert from 'node:assert/strict';
import {requireManualReviewOptions} from '../client/src/review/review-contract.ts';
import * as d from '../server/domain.mjs';

test('a legacy detail response missing options fails explicitly rather than pretending to load',()=>{
 assert.throws(()=>requireManualReviewOptions({proposal:{adapter:'MANUAL'}}),/server returned incomplete manual-review options/);
 assert.throws(()=>requireManualReviewOptions({proposal:{adapter:'MANUAL'},manual_review_options:{can_review:true}}),/incomplete manual-review options/);
});

test('valid authorized options and genuine empty options pass the response contract',()=>{
 const s=d.seed(),co=d.authUser(s,'co2');
 assert.doesNotThrow(()=>requireManualReviewOptions(d.updateDetail(s,co,s.incoming_updates[0].id)));
 s.colonies=[];s.cats=[];
 assert.doesNotThrow(()=>requireManualReviewOptions(d.updateDetail(s,co,s.incoming_updates[0].id)));
});

test('the golden adapter does not require manual-review options',()=>{
 assert.doesNotThrow(()=>requireManualReviewOptions({proposal:{adapter:'MOCK_V1'}}));
});

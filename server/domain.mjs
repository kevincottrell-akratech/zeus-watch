import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {catImagePrimary,catImageViews} from './cat-images.mjs';
import {explicitInstant,sourceTime,needsTimeConfirmation} from './source-time.mjs';
export const FIXTURES=resolve(import.meta.dirname,'../fixtures/synthetic');
export const NOW='2026-11-07T18:00:00.000Z';
const tables=['colonies','cats','memberships','observations','status_assertions','issues','actions','visits','volunteers','coordinators','assignments','incoming_updates','reviews'];
export const load=(path)=>JSON.parse(readFileSync(path,'utf8'));
export function fixture(dir,name){const path=resolve(FIXTURES,dir,`${name}.json`);return existsSync(path)?load(path):[];}
export function seed(mode='showcase'){if(!['golden','showcase'].includes(mode))fail(400,'INVALID_MODE','Choose golden or showcase');const s={mode,clock:NOW,audit:[],urgentFlags:[]};for(const t of tables)s[t]=fixture(mode==='golden'?'golden/bootstrap':'showcase',t);if(mode==='showcase'&&!s.assignments.length){for(const v of s.volunteers)s.assignments.push({volunteer_id:v.id,colony_id:s.colonies[((Number(v.alias?.replace(/\D/g,''))||1)-1)%s.colonies.length]?.id||s.colonies[0].id,can_claim:true,location_access:true,evidence_access:true,site_auth_state:'approved',valid_until:'2026-11-09T00:00:00Z'});}return s;}
export function fail(status,code,message){throw Object.assign(new Error(message),{status,code});}
export function req(condition,code='INVALID_INPUT',message='Invalid input',status=400){if(!condition)fail(status,code,message);}
export const hash=(obj)=>createHash('sha256').update(JSON.stringify(obj)).digest('hex');
export function find(s,t,id){return s[t].find(r=>r.id===id||r.alias===id);}
export function authUser(s,username){const alias=String(username||'').toUpperCase();if(alias==='ADMIN')return {id:'admin',alias:'ADMIN',display_name:'Demo administrator',role:'administrator'};const row=[...s.coordinators,...s.volunteers].find(v=>v.alias===alias&&v.active!==false);return row?{id:row.id,alias:row.alias,display_name:row.display_name,role:row.role||'volunteer'}:null;}
export const isCoord=u=>u.role==='coordinator';
export function coord(u){req(isCoord(u),'FORBIDDEN','Coordinator access required',403);}
export function care(u){req(u.role!=='administrator','FORBIDDEN','Administration alone does not grant care access',403);}
export function assignment(s,u,c){return s.assignments.find(a=>a.volunteer_id===u.id&&a.colony_id===c&&a.active!==false&&(!a.active_from||a.active_from<=s.clock)&&(!a.active_to||a.active_to>s.clock));}
export function privateAccess(s,u,c,flag){return isCoord(u)||Boolean(assignment(s,u,c)?.[flag]);}
export function audit(s,u,type,entity,reason=''){s.audit.push({id:randomUUID(),actor:u.display_name,actor_id:u.id,event_type:type,entity_id:entity,reason,timestamp:new Date().toISOString()});}
export function census(s,c){
 const rows=s.observations
  .filter(o=>o.colony_id===c&&o.coverage==='complete'&&!o.withdrawn_at&&o.observed_at)
  // Compare unambiguous instants without rewriting source timestamps/offsets.
  .map(observation=>({observation,instant:Date.parse(explicitInstant(observation.observed_at))}))
  .filter(row=>Number.isFinite(row.instant))
  .sort((a,b)=>b.instant-a.instant);
 const latest=rows[0];
 if(!latest)return {count_min:null,count_max:null,census_as_of:null,freshness:'unknown'};
 const r=latest.observation;
 const conflict=rows.some(({observation:o,instant})=>instant===latest.instant&&(o.count_min!==r.count_min||o.count_max!==r.count_max));
 return {count_min:conflict?null:r.count_min,count_max:conflict?null:r.count_max,census_as_of:r.observed_at,freshness:conflict?'conflicting':r.count_min==null?'unknown':Date.parse(s.clock)-latest.instant>604800000?'stale':'fresh'};
}
export function status(s,c){const assertions=s.status_assertions.filter(a=>a.cat_id===c.id&&!a.withdrawn_at).sort((a,b)=>(b.effective_at||'').localeCompare(a.effective_at||''));if(!assertions.length)return c.sterilization_summary||'unknown';const values=new Set(assertions.filter(a=>a.effective_at===assertions[0].effective_at).map(a=>a.asserted_value));return values.size>1?'conflicting':assertions[0].asserted_value;}
const quadrants=['Respond now','Plan focused care','Coordinate today','Maintain routine care'];
export function colonySummary(s,c){const issues=s.issues.filter(i=>i.colony_id===c.id&&!['resolved','dismissed'].includes(i.status));const cs=census(s,c.id);const qs=issues.map(i=>((['now','today'].includes(i.urgency)||i.due_at&&i.due_at<s.clock)?(i.impact==='high'?0:2):(i.impact==='high'?1:3)));let q=qs.length?Math.min(...qs):null;const due=s.actions.some(a=>a.colony_id===c.id&&!['confirmed','cancelled'].includes(a.state)&&a.due_at&&Date.parse(a.due_at)<=Date.parse(s.clock)+86400000);if(due&&(q===null||q>2))q=2;const flags=s.urgentFlags.filter(f=>f.colony_id===c.id&&f.state==='open');return {id:c.id,alias:c.alias,display_name:c.display_name,version:c.version,...cs,known_identity_count:s.cats.filter(k=>k.primary_colony_id===c.id).length,quadrant:q===null?(cs.freshness==='fresh'?quadrants[3]:'Needs update'):quadrants[q],color:issues.some(i=>i.urgency==='now')?'red':issues.some(i=>i.impact==='high'||i.urgency==='today')?'amber':issues.length?'blue':cs.freshness==='fresh'?'neutral':'gray',issue_count:issues.length,urgent_flag_count:flags.length,requires_site_authorization:!!c.requires_site_authorization,provenance_label:'synthetic_demo'};}
export function catSummary(s,c,u){const legacyImage=c.name==='Smokey'?'P01':c.name==='Flint'?'P03':c.name==='Luna'?'P05':null,canView=privateAccess(s,u,c.primary_colony_id,'evidence_access'),primary=s.mode==='showcase'?catImagePrimary(c.id):null;return {id:c.id,alias:c.alias,name:c.name,identity_state:c.identity_state,sterilization_summary:status(s,c),colony_id:c.primary_colony_id,version:c.version,photo_url:canView?(primary?.url||(legacyImage?`/api/v1/media/${legacyImage}`:null)):null,photo_alt:canView?primary?.alt_text||null:null,provenance_label:'synthetic_demo'};}
export function eligible(s,u,a){const v=s.volunteers.find(v=>v.id===u.id&&v.active!==false),as=assignment(s,u,a.colony_id),c=find(s,'colonies',a.colony_id);return !!(v&&as?.can_claim&&v.capabilities?.includes(a.capability)&&(!c?.requires_site_authorization||(as.site_auth_state==='approved'&&as.valid_until>s.clock)));}
export function actionSummary(s,u,a){const {outcome,...safe}=a;return {...safe,assignee_name:s.volunteers.find(v=>v.id===a.assignee_id)?.display_name||s.coordinators.find(v=>v.id===a.assignee_id)?.display_name||null,eligible:eligible(s,u,a),...(isCoord(u)||a.assignee_id===u.id?{outcome}:{} )};}
export function updateSummary(u,r){return {id:r.id,alias:r.alias,canonical_text:r.canonical_text,processing_state:r.processing_state,urgent_hint:r.urgent_hint,version:r.version,received_at:r.received_at,observed_at:r.observed_at,adapter:r.source_system==='fixture_golden_v1'?'MOCK_V1':'MANUAL'};}
function showcaseUpdateDisplay(s,r){
 if(s.mode!=='showcase'||r.source_system!=='fixture_showcase_v1'||r.synthetic!==true)return {};
 const links=s.reviews.filter(review=>review.update_id===r.id);
 if(links.length!==1||!links[0].proposed_colony_id)return {display_text:r.canonical_text,habitat_link_review:true};
 const colonies=s.colonies.filter(colony=>colony.id===links[0].proposed_colony_id);
 const habitat=colonies.length===1?colonies[0].alias?.match(/^C(\d{2})$/)?.[1]:null;
 if(!habitat)return {display_text:r.canonical_text,habitat_link_review:true};
 const sourcePrefix=r.canonical_text.match(/^Demo update for habitat (\d{2}):\s*/i);
 if(sourcePrefix&&sourcePrefix[1]!==habitat)return {display_text:r.canonical_text,habitat_link_review:true};
 const body=sourcePrefix?r.canonical_text.slice(sourcePrefix[0].length):r.canonical_text;
 return {display_text:`Habitat ${habitat} update: ${body}`};
}
export function dashboard(s,u){care(u);const colonies=s.colonies.map(c=>colonySummary(s,c)),cats=s.cats.map(c=>catSummary(s,c,u)),updates=s.incoming_updates.filter(r=>isCoord(u)||r.submitted_by===u.id).map(r=>({...updateSummary(u,r),...showcaseUpdateDisplay(s,r)}));return {user:u,datasetMode:s.mode,clock:s.clock,clockLabel:'Frozen synthetic demonstration clock',colonies,cats,issues:s.issues,actions:s.actions.map(a=>actionSummary(s,u,a)),updates,urgentFlags:s.urgentFlags.filter(f=>f.state==='open').map(f=>({id:f.id,colony_id:f.colony_id,update_id:f.update_id,label:'Needs urgent review'})),counts:{colonies:colonies.length,knownCats:cats.length,identified_cats:cats.length,completeCensusSum:colonies.reduce((a,c)=>a+(c.count_min??0),0),unknownColonies:colonies.filter(c=>c.count_min===null).length,pendingUpdates:updates.filter(r=>r.processing_state==='pending_review').length,openActions:s.actions.filter(a=>!['confirmed','cancelled'].includes(a.state)).length,fixed:cats.filter(c=>c.sterilization_summary==='fixed').length,not_fixed:cats.filter(c=>c.sterilization_summary==='not_fixed').length,unknown:cats.filter(c=>!['fixed','not_fixed'].includes(c.sterilization_summary)).length}};}
export function colonyDetail(s,u,id){care(u);const c=find(s,'colonies',id);req(c,'NOT_FOUND','Not found',404);return {...colonySummary(s,c),cats:s.cats.filter(k=>k.primary_colony_id===c.id).map(k=>catSummary(s,k,u)),issues:s.issues.filter(i=>i.colony_id===c.id),actions:s.actions.filter(a=>a.colony_id===c.id).map(a=>actionSummary(s,u,a)),observations:privateAccess(s,u,c.id,'evidence_access')?s.observations.filter(o=>o.colony_id===c.id):[],visits:privateAccess(s,u,c.id,'evidence_access')?s.visits.filter(v=>v.colony_id===c.id):[],...(privateAccess(s,u,c.id,'location_access')?{location:{latitude:c.reference_lat,longitude:c.reference_lon,radius_m:c.radius_m,synthetic:true}}:{})};}
export function catDetail(s,u,id){care(u);const c=find(s,'cats',id);req(c,'NOT_FOUND','Not found',404);const canView=privateAccess(s,u,c.primary_colony_id,'evidence_access');return {...catSummary(s,c,u),...(canView?{traits:c.traits,observations:s.observations.filter(o=>o.cat_id===c.id),status_assertions:s.status_assertions.filter(a=>a.cat_id===c.id),photo_views:s.mode==='showcase'?catImageViews(c.id):[]}: {})};}
export function locationCandidates(s,e,observed){if(e.evidence_type==='upload_device')return {candidates:[],warnings:['Upload context only; never a source-location match']};const {latitude:lat,longitude:lon,accuracy_m:a}=e;req(Number.isFinite(lat)&&Math.abs(lat)<=90&&Number.isFinite(lon)&&Math.abs(lon)<=180&&((a??null)===null||(Number.isFinite(a)&&a>=0)),'INVALID_LOCATION','Invalid location');const rad=x=>x*Math.PI/180;const warnings=[];if(a==null)warnings.push('Accuracy unknown');if(!e.captured_at)warnings.push('Capture time unknown');else{if(Date.parse(s.clock)-Date.parse(e.captured_at)>86400000)warnings.push('Historical location');if(Date.parse(e.captured_at)>Date.parse(s.clock)+300000)warnings.push('Future location');if(observed&&Math.abs(Date.parse(observed)-Date.parse(e.captured_at))>1800000)warnings.push('Observation and capture times conflict');}const candidates=s.colonies.filter(c=>c.reference_lat!=null&&c.reference_lon!=null).map(c=>{const dlat=rad(c.reference_lat-lat),dlon=rad(c.reference_lon-lon);const hav=Math.sin(dlat/2)**2+Math.cos(rad(lat))*Math.cos(rad(c.reference_lat))*Math.sin(dlon/2)**2;return {id:c.id,alias:c.alias,display_name:c.display_name,distance_m:6371008.8*2*Math.atan2(Math.sqrt(hav),Math.sqrt(1-hav)),radius_m:c.radius_m};}).filter(c=>c.distance_m<=c.radius_m+(a??0)).sort((a,b)=>a.distance_m-b.distance_m||a.id.localeCompare(b.id));if(candidates.length>1)warnings.push('Overlapping candidates: human choice required');return {candidates,warnings,requires_confirmation:true};}
const effectMap={R01:[['cats','K005'],['memberships','MEMK005']],R03:[['cats','K006'],['memberships','MEMK006']],R05:[['issues','I01'],['actions','A01']],R06:[['issues','I02']],R07:[['issues','I03']],R08:[['actions','A02']],R09:[['visits','VST01']],R10:[['status_assertions','SR10']],R11:[['status_assertions','SR11']]};
export function proposal(s,r){const golden=r.source_system==='fixture_golden_v1';const blocked=['R12','R14'].includes(r.alias);let records=[];if(golden){for(const [t,alias] of effectMap[r.alias]||[])records.push({table:t,record:fixture('golden/expected/after_review',t).find(x=>x.alias===alias)});const o=fixture('golden/expected/after_review','observations').find(o=>o.incoming_update_id===r.id);if(o)records.push({table:'observations',record:o});}return {adapter:golden?'MOCK_V1':'MANUAL',summary:golden?(r.alias==='R15'?'Instructions in source are not authority. Reject this input.':blocked?'Ambiguous location or identity. Keep pending for review.':'Deterministic demo suggestions. Review source and effects before accepting.'):'Manual review required. Supply an observation to accept this report.',reviewable:!blocked&&r.alias!=='R15',reason:blocked?'Unresolved identity or colony':null,effects:records.map(x=>({type:x.table,...x.record})),records};}
export function manualReviewOptions(s,u){
 coord(u);
 // Coordinators already have global care-review access; assignments do not grant
 // volunteers review authority. Never expose private evidence in option labels.
 const habitats=s.colonies.map(c=>({id:c.id,alias:c.alias,display_name:c.display_name||c.alias}));
 const habitatIds=new Set(habitats.map(c=>c.id));
 const cats=s.cats.filter(c=>habitatIds.has(c.primary_colony_id)).map(c=>({id:c.id,alias:c.alias,name:c.name||c.alias,colony_id:c.primary_colony_id}));
 return {can_review:true,habitats,cats,can_create_identity:habitats.length>0,reason:habitats.length?null:'No habitats are recorded for manual review. Leave this report pending and ask a coordinator to check the available records.'};
}
export function updateDetail(s,u,id){
 coord(u);const r=find(s,'incoming_updates',id);req(r,'NOT_FOUND','Not found',404);
 const p=proposal(s,r);delete p.records;
 const reviewed_observations=s.observations.filter(o=>o.incoming_update_id===r.id).map(o=>({
  id:o.id,colony_id:o.colony_id,cat_id:o.cat_id??null,coverage:o.coverage,
  count_min:o.count_min,count_max:o.count_max,observed_at:o.observed_at
 }));
 return {...r,source:r.canonical_text,source_time:sourceTime(r),proposal:p,reviewed_observations,...(p.adapter==='MANUAL'?{manual_review_options:manualReviewOptions(s,u)}:{}),media:(r.media_filenames||[]).filter(n=>/^P0[1235]\.png$/.test(n)).map(n=>({name:n,url:`/api/v1/media/${n.slice(0,-4)}`,synthetic:true})),locations:(r.location_evidence||[]).map(e=>({...e,...locationCandidates(s,e,r.observed_at)}))};
}
export function importGolden(s,u){coord(u);req(s.mode==='golden','MODE_CONFLICT','Reset to GOLDEN before importing its fixture',409);let imported=0,duplicates=0;for(const r of fixture('golden/import','canonical_events')){if(s.incoming_updates.some(x=>x.source_system===r.source_system&&x.source_event_id===r.source_event_id)){duplicates++;continue;}s.incoming_updates.push({...r,submitted_by:u.id});if(r.urgent_hint)s.urgentFlags.push({id:randomUUID(),update_id:r.id,colony_id:r.named_colony_id,state:'open'});imported++;}audit(s,u,'batch_import','golden',`${imported} imported; ${duplicates} duplicates`);return {imported,duplicates,total:15};}
function version(row,body){req(body.expected_version===row.version,'VERSION_CONFLICT','This record changed. Refresh before retrying.',409);}
export function review(s,u,id,b){
 coord(u);
 const r=find(s,'incoming_updates',id);
 req(r,'NOT_FOUND','Not found',404);
 version(r,b);
 req(r.processing_state==='pending_review','REVIEW_CONFLICT','Already reviewed',409);
 req(['approve','reject'].includes(b.decision),'INVALID_DECISION','Approve or reject required');
 req(typeof b.reason==='string'&&b.reason.trim().length>=3&&b.reason.length<=1000,'REASON_REQUIRED','Add a review reason');
 const decision={id:randomUUID(),update_id:r.id,reviewer_id:u.id,reviewed_at:new Date().toISOString(),reason:b.reason,outcome:b.decision};
 if(b.decision==='approve'){
  const p=proposal(s,r);
  req(p.reviewable,'REVIEW_REQUIRED',p.reason||'Source instructions cannot be approved');
  let ops=p.records;
  if(p.adapter==='MANUAL'){
   const o=b.observation;
   req(o&&['complete','partial','not_count'].includes(o.coverage),'OBSERVATION_REQUIRED','A manual observation is required');
   const col=find(s,'colonies',o.colony_id);
   req(col,'INVALID_REFERENCE','Choose a valid colony');
   req(explicitInstant(o.observed_at),'INVALID_TIME','Observation time requires a valid ISO timestamp with an explicit UTC or numeric offset');
   req(!needsTimeConfirmation(r,o.observed_at)||o.time_confirmed===true,'TIME_CONFIRMATION_REQUIRED','Explicitly confirm the observation time and timezone from supporting evidence, or leave this update pending.');
   decision.time_review={source:sourceTime(r),chosen_observed_at:o.observed_at,explicitly_confirmed:o.time_confirmed===true};
   req(Date.parse(o.observed_at)<=Date.now()+300000,'FUTURE_TIME','Observation time is in the future. Confirm the source time and timezone.');
   const min=o.count_min??null,max=o.count_max??null;
   req((min===null&&max===null)||(Number.isInteger(min)&&Number.isInteger(max)&&min>=0&&max>=min),'INVALID_COUNT','Counts must form a nonnegative integer range');
   req(o.coverage!=='not_count'||min===null,'INVALID_COUNT','Not-count observation cannot contain counts');
   let cat=o.cat_id?find(s,'cats',o.cat_id):null;
   req(!o.cat_id||cat,'INVALID_REFERENCE','Unknown cat');
   req(!cat||cat.primary_colony_id===col.id,'IDENTITY_COLONY_MISMATCH','The selected cat is not recorded in this habitat. Keep identity unresolved or choose a cat recorded here.');
   if(b.new_cat){
    req(!o.cat_id,'IDENTITY_CONFLICT','Choose existing or new identity, not both');
    req(typeof b.new_cat.name==='string'&&b.new_cat.name.trim().length>0&&b.new_cat.name.length<=120,'INVALID_CAT','New cat name required');
    req(b.new_cat.confirm_distinct===true,'IDENTITY_REVIEW_REQUIRED','Explicit distinct identity confirmation required');
    cat={id:randomUUID(),alias:`K-${s.cats.length+1}`,name:b.new_cat.name,traits:String(b.new_cat.traits||'').slice(0,1000),primary_colony_id:col.id,identity_state:'confirmed',sterilization_summary:'unknown',version:1,synthetic:true,provenance_label:'synthetic_demo',source_update_id:r.id};
   }
   ops=[{table:'observations',record:{id:randomUUID(),version:1,colony_id:col.id,cat_id:cat?.id||null,coverage:o.coverage,count_min:min,count_max:max,observed_at:o.observed_at,source_assertion:r.canonical_text,incoming_update_id:r.id,review_decision_id:decision.id,synthetic:true,provenance_label:'synthetic_demo'}}];
   if(b.new_cat){
    ops.unshift({table:'cats',record:cat});
    ops.push({table:'memberships',record:{id:randomUUID(),version:1,cat_id:cat.id,colony_id:col.id,effective_from:o.observed_at,effective_to:null,decision_id:decision.id,synthetic:true}});
   }
   if(b.issue){
    const i=b.issue;
    req(['injury_sign','reproduction_concern','kittens','feeding_coverage','supplies','other'].includes(i.category)&&['now','today','scheduled','routine'].includes(i.urgency)&&['high','routine'].includes(i.impact),'INVALID_ISSUE','Valid category, urgency and impact required');
    req(typeof i.factual_summary==='string'&&i.factual_summary.trim()&&i.factual_summary.length<=1000&&typeof i.resolution_criteria==='string'&&i.resolution_criteria.trim()&&i.resolution_criteria.length<=1000,'INVALID_ISSUE','Factual summary and resolution criteria required');
    const issue={id:randomUUID(),alias:`I-${s.issues.length+1}`,version:1,colony_id:col.id,cat_id:cat?.id||null,category:i.category,urgency:i.urgency,impact:i.impact,factual_summary:i.factual_summary,resolution_criteria:i.resolution_criteria,responsible_coordinator_id:u.id,status:'open',first_observation_id:ops.find(x=>x.table==='observations').record.id,synthetic:true,provenance_label:'synthetic_demo'};
    ops.push({table:'issues',record:issue});
   }
  }
for(const {table,record} of ops){req(record,'INVALID_PROPOSAL','Missing proposal');if(table==='observations'&&record.cat_id)req(s.cats.some(c=>c.id===record.cat_id)||ops.some(op=>op.table==='cats'&&op.record.id===record.cat_id),'DEPENDENCY_REQUIRED','Review the cat identity report first',409);if(!s[table].some(x=>x.id===record.id))s[table].push({...record,review_decision_id:decision.id,source_update_id:r.id});}for(const f of s.urgentFlags.filter(f=>f.update_id===r.id&&f.state==='open')){if(ops.some(o=>o.table==='issues'))f.state='converted';}r.processing_state='approved';}else{r.processing_state='rejected';for(const f of s.urgentFlags.filter(f=>f.update_id===r.id))f.state='dismissed';}r.version++;s.reviews.push(decision);audit(s,u,'review_'+b.decision,r.id,b.reason);return updateSummary(u,r);}
export function report(s,u,b){care(u);req(b.permission_basis==='synthetic_demo','SYNTHETIC_ONLY','Only synthetic demonstration data is accepted');req(typeof b.canonical_text==='string'&&b.canonical_text.trim().length>0&&b.canonical_text.length<=20000,'INVALID_TEXT','Enter a report of 1–20,000 characters');req(!b.colony_id||find(s,'colonies',b.colony_id),'INVALID_REFERENCE','Unknown colony');req(!b.observed_at||Number.isFinite(Date.parse(b.observed_at)),'INVALID_TIME','Invalid observation time');req(b.urgent_hint===undefined||typeof b.urgent_hint==='boolean','INVALID_FLAG','Urgent flag must be boolean');const sourceId=b.source_event_id||randomUUID();req(typeof sourceId==='string'&&sourceId.length<=160,'INVALID_SOURCE_KEY','Source event ID too long');const r={id:randomUUID(),alias:`REPORT-${s.incoming_updates.length+1}`,version:1,source_system:'direct_form',source_event_id:sourceId,canonical_text:b.canonical_text,permission_basis:'synthetic_demo',submitted_by:u.id,received_at:new Date().toISOString(),observed_at:b.observed_at||null,named_colony_id:b.colony_id||null,urgent_hint:!!b.urgent_hint,processing_state:'pending_review',media_ids:b.media_ids||[],location_evidence:b.location_evidence||[],synthetic:true,provenance_label:'synthetic_demo'};const prior=s.incoming_updates.find(r=>r.source_system==='direct_form'&&r.source_event_id===sourceId);if(prior){req(prior.canonical_text===r.canonical_text&&prior.named_colony_id===r.named_colony_id&&prior.urgent_hint===r.urgent_hint&&prior.observed_at===r.observed_at&&hash(prior.media_ids||[])===hash(r.media_ids||[])&&hash(prior.location_evidence||[])===hash(r.location_evidence||[]),'SOURCE_KEY_CONFLICT','Source key reused with different data',409);return updateSummary(u,prior);}s.incoming_updates.push(r);if(r.urgent_hint)s.urgentFlags.push({id:randomUUID(),update_id:r.id,colony_id:r.named_colony_id,state:'open'});audit(s,u,'report_received',r.id);return updateSummary(u,r);}
export function transition(s,u,id,cmd,b){care(u);const a=find(s,'actions',id);req(a,'NOT_FOUND','Not found',404);version(a,b);const own=a.assignee_id===u.id;const coordinator=isCoord(u);const reason=()=>req(typeof b.reason==='string'&&b.reason.trim().length>=3&&b.reason.length<=1000,'REASON_REQUIRED','Reason required');const states=(...allowed)=>req(allowed.includes(a.state),'STATE_CONFLICT',`Cannot ${cmd} from ${a.state}`,409);const owner=()=>req(own||coordinator,'FORBIDDEN','Only owner or coordinator may do this',403);switch(cmd){case 'claim':states('open','reopened');req(!a.assignee_id,'CLAIM_CONFLICT','Already claimed',409);req(eligible(s,u,a),'INELIGIBLE','Active assignment, capability and site authorization required',403);a.state='claimed';a.assignee_id=u.id;a.claimed_at=new Date().toISOString();break;case 'start':states('claimed');owner();a.state='in_progress';break;case 'block':states('claimed','in_progress');owner();reason();req(b.next_review_at&&Number.isFinite(Date.parse(b.next_review_at)),'NEXT_REVIEW_REQUIRED','Next review time required');a.state='blocked';a.blocked_reason=b.reason;a.next_review_at=b.next_review_at;break;case 'resume':states('blocked');owner();a.state='in_progress';break;case 'release':states('claimed','blocked','in_progress');owner();reason();if(a.state==='in_progress')coord(u);a.state='open';a.assignee_id=null;break;case 'submit_completion':states('claimed','in_progress','blocked');owner();req(typeof b.outcome==='string'&&b.outcome.trim().length>=3&&b.outcome.length<=2000,'OUTCOME_REQUIRED','Describe the observed outcome');req(['done','partial','not_done'].includes(b.result),'RESULT_REQUIRED','Choose done, partial or not_done');a.state='completion_submitted';a.outcome=b.outcome;a.result=b.result;a.submitted_by=u.id;a.performer_id=a.assignee_id;a.submitted_at=new Date().toISOString();break;case 'confirm_completion':states('completion_submitted');coord(u);req(u.id!==a.performer_id&&u.id!==a.submitted_by,'SELF_REVIEW','A different coordinator must confirm',403);req(a.result==='done','INCOMPLETE_OUTCOME','Partial or incomplete work cannot be confirmed',409);reason();a.state='confirmed';a.reviewed_by=u.id;a.reviewed_at=new Date().toISOString();break;case 'return_completion':states('completion_submitted');coord(u);reason();a.state='in_progress';break;case 'cancel':coord(u);req(a.state!=='confirmed','STATE_CONFLICT','Confirmed work must be reopened',409);reason();a.state='cancelled';break;case 'reopen':states('confirmed','cancelled');coord(u);reason();a.state='reopened';a.assignee_id=null;break;default:fail(400,'INVALID_COMMAND','Unsupported action command');}a.version++;audit(s,u,`action_${cmd}`,a.id,b.reason||b.outcome||'');return actionSummary(s,u,a);}

export function issueTransition(s,u,id,command,b){coord(u);const row=find(s,'issues',id);req(row,'NOT_FOUND','Not found',404);version(row,b);req(typeof b.reason==='string'&&b.reason.trim().length>=3&&b.reason.length<=1000,'REASON_REQUIRED','Reason required');req(['resolve','reopen','dismiss','monitor'].includes(command),'INVALID_COMMAND','Invalid issue command');if(command==='resolve')req(b.criteria_checked===true,'CRITERIA_REQUIRED','Confirm resolution criteria were checked');row.status={resolve:'resolved',reopen:'reopened',dismiss:'dismissed',monitor:'monitoring'}[command];row.version++;row.resolution_reason=b.reason;audit(s,u,`issue_${command}`,id,b.reason);return row;}

// Pure source interpretation shared by the API and review UI. Never uses a clock
// or the host timezone to fill missing evidence.
export function explicitInstant(value){
 if(typeof value!=='string')return null;
 const m=value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/i);
 if(!m)return null;
 const [,year,month,day,hour,minute,second='',fraction='',offset]=m;
 const y=Number(year),mo=Number(month),d=Number(day);
 const days=new Date(Date.UTC(y,mo,0)).getUTCDate();
 if(mo<1||mo>12||d<1||d>days||Number(hour)>23||Number(minute)>59||Number(second)>59)return null;
 if(offset!=='Z'&&offset!=='z'&&(Number(offset.slice(1,3))>14||Number(offset.slice(4))>59||(Number(offset.slice(1,3))===14&&Number(offset.slice(4))!==0)))return null;
 const instant=Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second||'00'}${fraction?'.'+fraction:''}${offset}`);
 return Number.isFinite(instant)?new Date(instant).toISOString():null;
}

export function sourceTime(record){
 const evidence=record.imported_evidence;
 const reported=evidence&&Object.hasOwn(evidence,'observed_at')?evidence.observed_at:record.observed_at??null;
 const raw=typeof evidence?.source_timestamp_text==='string'?evidence.source_timestamp_text:reported;
 const kind=record.source_system==='upload_txt'?'message':'observation';
 const legacy=kind==='message'&&!evidence?.source_timestamp_text;
 const zoneValue=evidence?.source_timezone??evidence?.timezone??null;
 const declaredZone=typeof zoneValue==='string'?zoneValue:null;
 const offset=typeof raw==='string'?raw.match(/(Z|[+-]\d{2}:\d{2})$/i)?.[1]:null;
 const timezone=legacy?null:declaredZone||(offset?(offset.toUpperCase()==='Z'?'UTC':`UTC${offset}`):null);
 const candidate=reported;
 const instant=legacy?null:explicitInstant(candidate);
 const zoneConflict=declaredZone==='UTC'&&offset&&!['Z','z','+00:00','-00:00'].includes(offset);
 const status=!raw?'missing':legacy||!timezone||!instant||zoneConflict?'ambiguous':'known';
 return {raw:typeof raw==='string'?raw:null,kind,timezone,instant:status==='known'?instant:null,status,
  raw_label:legacy?'Stored import interpretation (original timestamp format not retained)':`Source ${kind} timestamp`,
  explanation:status==='missing'?'No observation timestamp was recorded. Enter a supported observation time and explicitly confirm it.':
   legacy?'This older TXT import retained a UTC interpretation but not the original timestamp text or a confirmed source timezone. Confirm the observation time from supporting evidence.':
   status==='ambiguous'?'The source timestamp does not establish an unambiguous instant and timezone. Resolve it from supporting evidence; no current or demo time is assumed.':
   kind==='message'?'This is a message timestamp, not automatically the time the cats were observed. Confirm the supported observation time.':
   'The source provides an explicit UTC instant or offset. Review time is shown in UTC without changing the source.'};
}

export function utcReviewValue(instant){return explicitInstant(instant)?.slice(0,-1)||'';}
export function reviewInstant(value){return typeof value==='string'&&value?explicitInstant(value+'Z'):null;}
export function needsTimeConfirmation(record,instant){
 const source=sourceTime(record);
 return source.status!=='known'||source.kind==='message'||source.instant!==explicitInstant(instant);
}

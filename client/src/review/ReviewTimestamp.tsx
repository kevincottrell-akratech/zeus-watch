import {sourceTime,reviewInstant,needsTimeConfirmation} from '../../../server/source-time.mjs';
import './review-timestamp.css';

type RecordData=Record<string,any>;
export function SourceTimestamp({record}:{record:RecordData}){
 const source=sourceTime(record);
 return <section className="source-timestamp" aria-label="Source timestamp">
  <h3>Source timestamp</h3>
  <dl><dt>{source.raw_label}</dt><dd data-source-time="raw">{source.raw||'Not recorded'}</dd>
   <dt>Source timezone / declared import interpretation</dt><dd>{source.timezone||'Not recorded — timezone unresolved'}</dd>
   {source.instant&&<><dt>Equivalent UTC instant</dt><dd>{source.instant}</dd></>}
  </dl>
  <p className={source.status==='known'?'help':'notice'} data-time-status={source.status}>{source.explanation}</p>
  <p className="help">Received by this app: {record.received_at||'Not recorded'}. Receipt time is not an observation time.</p>
  {(record.reviewed_observations||[]).map((observation:RecordData)=><p className="reviewed-observation-time" key={observation.id}>Reviewed observation time (explicit UTC/offset): {observation.observed_at||'Not recorded'}</p>)}
 </section>;
}

export default function ReviewTimestamp({record,value,onChange,confirmed,onConfirm}:{
 record:RecordData;value:string;onChange:(value:string)=>void;confirmed:boolean;onConfirm:(value:boolean)=>void;
}){
 const needsConfirmation=needsTimeConfirmation(record,reviewInstant(value));
 return <div className="review-timestamp">
  <label>Supported observation time (UTC)<input id="manual-observed-at" type="datetime-local" step="0.001" value={value} aria-describedby="review-time-help" onChange={e=>{onChange(e.target.value);onConfirm(false)}}/></label>
  <p id="review-time-help" className="help">Enter UTC, not browser-local time. No current or frozen demo time is substituted. Leave the update pending if evidence cannot establish when the observation occurred.</p>
  {needsConfirmation&&<label className="checkbox"><input id="manual-time-confirmed" type="checkbox" checked={confirmed} aria-required="true" onChange={e=>onConfirm(e.target.checked)}/><span>I confirmed this observation time and its UTC interpretation from supporting evidence. Explain the basis in the review reason.</span></label>}
 </div>;
}

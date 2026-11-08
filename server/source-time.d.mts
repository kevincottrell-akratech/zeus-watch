export type SourceTime = {
 raw:string|null;kind:string;timezone:string|null;instant:string|null;
 status:'missing'|'ambiguous'|'known';raw_label:string;explanation:string;
};
export function explicitInstant(value:unknown):string|null;
export function sourceTime(record:Record<string,any>):SourceTime;
export function utcReviewValue(instant:unknown):string;
export function reviewInstant(value:unknown):string|null;
export function needsTimeConfirmation(record:Record<string,any>,instant:unknown):boolean;

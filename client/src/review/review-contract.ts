export type ManualReviewOptions = {
  can_review: boolean;
  reason: string | null;
  habitats: Array<{ id: string; display_name: string; alias: string }>;
  cats: Array<{ id: string; name: string; alias: string; colony_id: string }>;
  can_create_identity: boolean;
};

// Options arrive with the authorized detail response, not a second request.
// An old API response is a contract failure, not options still loading.
export function requireManualReviewOptions(detail: any): void {
  if (detail?.proposal?.adapter !== 'MANUAL') return;
  const options = detail.manual_review_options;
  const valid = options &&
    typeof options.can_review === 'boolean' &&
    typeof options.can_create_identity === 'boolean' &&
    (options.reason === null || typeof options.reason === 'string') &&
    Array.isArray(options.habitats) &&
    options.habitats.every((c: any) =>
      c && typeof c.id === 'string' && typeof c.alias === 'string' && typeof c.display_name === 'string') &&
    Array.isArray(options.cats) &&
    options.cats.every((c: any) =>
      c && typeof c.id === 'string' && typeof c.alias === 'string' &&
      typeof c.name === 'string' && typeof c.colony_id === 'string');
  if (!valid) {
    throw new Error('The server returned incomplete manual-review options. Restart the Zeus Watch Run workflow, then reopen this update. No review has been saved.');
  }
}

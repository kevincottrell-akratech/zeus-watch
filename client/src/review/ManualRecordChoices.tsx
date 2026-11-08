import InPageSelect from "./InPageSelect";
import type { ManualReviewOptions } from "./review-contract";
export type { ManualReviewOptions } from "./review-contract";
import "./manual-record-choices.css";

type ManualRecordChoicesProps = {
  options?: ManualReviewOptions;
  habitatId: string;
  catId: string;
  onHabitatChange: (id: string) => void;
  onCatChange: (id: string) => void;
  newName: string;
  onNewNameChange: (v: string) => void;
  newTraits: string;
  onNewTraitsChange: (v: string) => void;
  confirmDistinct: boolean;
  onConfirmDistinctChange: (v: boolean) => void;
  onReload: () => void;
};

export default function ManualRecordChoices({
  options,
  habitatId,
  catId,
  onHabitatChange,
  onCatChange,
  newName,
  onNewNameChange,
  newTraits,
  onNewTraitsChange,
  confirmDistinct,
  onConfirmDistinctChange,
  onReload,
}: ManualRecordChoicesProps) {
  const hasOptions = options !== undefined;
  const allowed = Boolean(options?.can_review);
  const habitats = options?.habitats ?? [];
  const habitatIsValid = habitats.some((habitat) => habitat.id === habitatId);
  const cats = options?.cats.filter((cat) => cat.colony_id === habitatId) ?? [];
  const canCreateIdentity = Boolean(allowed && habitatIsValid && options?.can_create_identity);
  const catDisabled = !hasOptions || !allowed || !habitatIsValid;
  const catIsNew = catId === "new" && canCreateIdentity;
  const selectedCatIsAvailable = cats.some((cat) => cat.id === catId);
  const shownCatId = catIsNew || selectedCatIsAvailable ? catId : "";

  const handleHabitatChange = (value: string) => {
    onHabitatChange(value);
  };
  const handleCatChange = (value: string) => {
    onCatChange(value);
  };

  return (
    <section className="manual-record-choices" aria-labelledby="manual-record-choices-heading">
      <h3 className="manual-record-choices__heading" id="manual-record-choices-heading">
        Habitat and cat identity
      </h3>
      <p className="manual-record-choices__intro">
        Review the source evidence before linking stable records. Leave either choice unresolved when the
        evidence does not support a match.
      </p>

      {!hasOptions && (
        <div className="manual-record-choices__notice" role="status">
          <strong>Review options are not available yet.</strong>
          <p>
            They may still be loading or may be missing from this update detail. Keep the update pending
            and close this review, or reload the review options before continuing.
          </p>
          <button className="manual-record-choices__reload" type="button" onClick={onReload}>
            Reload review options
          </button>
        </div>
      )}

      {hasOptions && !allowed && (
        <div className="manual-record-choices__notice manual-record-choices__notice--restricted" role="status">
          <strong>Identity choices are restricted for this review.</strong>
          <p>
            {options?.reason || "You cannot review identity links for this update."} Keep it pending and close
            the review; do not choose or create a record.
          </p>
        </div>
      )}

      {hasOptions && allowed && habitats.length === 0 && (
        <div className="manual-record-choices__notice manual-record-choices__notice--quiet" role="status">
          <strong>No habitats are available to review.</strong>
          <p>Keep the habitat unresolved and leave the update pending, then close this review.</p>
        </div>
      )}

      <div className="manual-record-choices__field">
        <label htmlFor="manual-habitat-trigger">Habitat</label>
        <InPageSelect
          id="manual-habitat"
          label="Habitat"
          value={habitatIsValid ? habitatId : ""}
          onChange={handleHabitatChange}
          disabled={!hasOptions || !allowed || habitats.length === 0}
          describedBy="manual-habitat-help"
          options={[{value:"",label:"Unresolved — do not link a habitat"},...habitats.map(habitat=>({value:habitat.id,label:`${habitat.display_name} · ${habitat.alias}`}))]}
        />
        <p className="manual-record-choices__help" id="manual-habitat-help">
          {!hasOptions
            ? "Unavailable because review options have not loaded."
            : !allowed
              ? "Unavailable because identity review is restricted."
              : habitats.length === 0
                ? "No habitat records were supplied; the habitat remains unresolved."
                : "Choose a stable habitat ID only when supported by the reviewed evidence."}
        </p>
      </div>

      {hasOptions && allowed && habitatIsValid && cats.length === 0 && (
        <div className="manual-record-choices__notice manual-record-choices__notice--quiet" role="status">
          <strong>No cat records are available for this habitat.</strong>
          <p>
            Keep the cat unresolved, or choose a distinct new identity only if the source evidence supports
            that decision and identity creation is allowed.
          </p>
        </div>
      )}

      <div className="manual-record-choices__field">
        <label htmlFor="manual-cat-trigger">Cat</label>
        <InPageSelect
          id="manual-cat"
          label="Cat"
          value={shownCatId}
          onChange={handleCatChange}
          disabled={catDisabled}
          describedBy="manual-cat-help"
          options={[{value:"",label:"Unresolved — do not link a cat"},...cats.map(cat=>({value:cat.id,label:`${cat.name} · ${cat.alias}`})),...(canCreateIdentity?[{value:"new",label:"Create a distinct new identity — reviewed decision required"}]:[])]}
        />
        <p className="manual-record-choices__help" id="manual-cat-help">
          {!hasOptions
            ? "Unavailable until review options are loaded."
            : !allowed
              ? "Unavailable because identity review is restricted."
              : !habitatIsValid
                ? "Select an available habitat first; cats are shown only for that stable habitat ID."
                : cats.length === 0
                  ? canCreateIdentity
                    ? "No cat matches are listed. Keep unresolved or explicitly review a distinct new identity."
                    : "No cat records are listed. The cat can remain unresolved."
                  : "Only cats belonging to the selected habitat are listed; unresolved remains a valid choice."}
        </p>
      </div>

      {catIsNew && (
        <div className="manual-record-choices__new-identity">
          <p>
            This creates a distinct identity; it does not link to an existing cat. Enter only details
            supported by the source evidence.
          </p>
          <div className="manual-record-choices__field">
            <label htmlFor="manual-new-cat-name">New cat name</label>
            <input
              id="manual-new-cat-name"
              value={newName}
              onChange={(event) => onNewNameChange(event.currentTarget.value)}
              autoComplete="off"
            />
          </div>
          <div className="manual-record-choices__field">
            <label htmlFor="manual-new-cat-traits">Identifying traits</label>
            <textarea
              id="manual-new-cat-traits"
              value={newTraits}
              onChange={(event) => onNewTraitsChange(event.currentTarget.value)}
              rows={3}
            />
          </div>
          <label className="manual-record-choices__confirm" htmlFor="manual-confirm-distinct">
            <input
              id="manual-confirm-distinct"
              type="checkbox"
              checked={confirmDistinct}
              onChange={(event) => onConfirmDistinctChange(event.currentTarget.checked)}
            />
            <span>I reviewed the evidence and confirm this is a distinct identity, not a known cat.</span>
          </label>
        </div>
      )}
    </section>
  );
}

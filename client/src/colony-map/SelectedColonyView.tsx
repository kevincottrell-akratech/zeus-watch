import type { ReactNode } from "react";
import { X, ShieldCheck } from "lucide-react";
import type { ColonyMapData, ColonyMapRow } from "./ColonyMap";
import SelectedParkMap from "./SelectedParkMap";
import "./selected-colony.css";

type Props = {
  colony: ColonyMapRow;
  mapData: ColonyMapData;
  onClose: () => void;
  children: ReactNode;
};

function displayName(colony: ColonyMapRow) {
  return String(colony.display_name || colony.alias || "Unnamed colony");
}

export default function SelectedColonyView({
  colony,
  mapData,
  onClose,
  children,
}: Props) {
  return (
    <div
      className="modal-backdrop colony-selection-backdrop"
      onClick={onClose}
    >
      <section
        className="colony-selection-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="colony-selection-header">
          <div className="colony-selection-heading">
            <span className="colony-selection-kicker">Selected colony · stable record</span>
            <h2 id="drawer-title">{displayName(colony)}</h2>
          </div>
          <button
            className="colony-selection-close"
            type="button"
            aria-label="Close details"
            onClick={onClose}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="colony-selection-body">
          <SelectedParkMap colony={colony} mapData={mapData} />
          <div className="colony-selection-details">{children}</div>
        </div>

        <footer className="colony-selection-footer">
          <div className="colony-selection-notice">
            <ShieldCheck size={13} aria-hidden="true" />
            <span>Human-reviewed fictional rescue-care workspace. Map pin is a fictional park reference, not a real colony location.</span>
          </div>
          <div className="colony-selection-attribution">
            <p>{mapData.attribution.countyDisclaimer}</p>
            <div className="colony-selection-attribution-links">
              <a href={mapData.attribution.countySourceUrl} target="_blank" rel="noreferrer">County park boundary source</a>
              <a href={mapData.attribution.countyPointSourceUrl} target="_blank" rel="noreferrer">County park point source</a>
              <a href={mapData.attribution.countyTermsUrl} target="_blank" rel="noreferrer">County terms and disclaimer</a>
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
}

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "./drawer-layer.css";

type DrawerLayerProps = {
  children: ReactNode;
  open: boolean;
};

export default function DrawerLayer({ children, open }: DrawerLayerProps) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="zw-drawer-layer">{children}</div>,
    document.body,
  );
}

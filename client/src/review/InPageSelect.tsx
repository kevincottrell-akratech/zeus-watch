import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import "./in-page-select.css";

export type InPageSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type InPageSelectProps = {
  id: string;
  label: string;
  value: string;
  options: Array<InPageSelectOption>;
  onChange: (value: string) => void;
  disabled?: boolean;
  describedBy?: string;
};

export default function InPageSelect({
  id,
  label,
  value,
  options,
  onChange,
  disabled = false,
  describedBy,
}: InPageSelectProps) {
  const generatedId = useId();
  const listboxId = `${id}-listbox`;
  const optionPrefix = `${id}-${generatedId.replace(/:/g, "")}-option`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [activeValue, setActiveValue] = useState<string | null>(null);
  const enabledOptions = options.filter((option) => !option.disabled);
  const activeOptionIndex = enabledOptions.findIndex((option) => option.value === activeValue);
  const activeOption = activeOptionIndex >= 0 ? enabledOptions[activeOptionIndex] : undefined;
  const activeOptionId =
    activeOption === undefined
      ? undefined
      : `${optionPrefix}-${options.findIndex((option) => option.value === activeOption.value)}`;
  const selectedOption = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePointer = (event: globalThis.PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActiveValue(null);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  useEffect(() => {
    if (!open || activeOptionId === undefined) return;
    document.getElementById(activeOptionId)?.scrollIntoView({ block: "nearest" });
  }, [activeOptionId, open]);

  const openAtSelection = () => {
    setActiveValue(
      options.find((option) => option.value === value && !option.disabled)?.value ?? null,
    );
    setOpen(true);
  };

  const moveActive = (direction: "next" | "previous" | "first" | "last") => {
    if (enabledOptions.length === 0) {
      setActiveValue(null);
      return;
    }

    if (direction === "first") {
      setActiveValue(enabledOptions[0].value);
      return;
    }
    if (direction === "last") {
      setActiveValue(enabledOptions[enabledOptions.length - 1].value);
      return;
    }

    const currentIndex = enabledOptions.findIndex((option) => option.value === activeValue);
    const nextIndex =
      direction === "next"
        ? currentIndex < 0
          ? 0
          : (currentIndex + 1) % enabledOptions.length
        : currentIndex < 0
          ? enabledOptions.length - 1
          : (currentIndex - 1 + enabledOptions.length) % enabledOptions.length;
    setActiveValue(enabledOptions[nextIndex].value);
  };

  const commit = (nextValue: string) => {
    const option = options.find((candidate) => candidate.value === nextValue);
    if (!option || option.disabled || disabled) return;
    onChange(nextValue);
    setOpen(false);
    setActiveValue(null);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        setActiveValue(null);
      }
      return;
    }

    if (event.key === "Tab") {
      if (open) {
        setOpen(false);
        setActiveValue(null);
      }
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        const selectedIndex = enabledOptions.findIndex((option) => option.value === value);
        const nextIndex =
          event.key === "ArrowDown"
            ? selectedIndex < 0
              ? 0
              : (selectedIndex + 1) % enabledOptions.length
            : selectedIndex < 0
              ? enabledOptions.length - 1
              : (selectedIndex - 1 + enabledOptions.length) % enabledOptions.length;
        setActiveValue(enabledOptions.length > 0 ? enabledOptions[nextIndex]?.value ?? null : null);
      } else {
        moveActive(event.key === "ArrowDown" ? "next" : "previous");
      }
      return;
    }

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      if (!open) setOpen(true);
      moveActive(event.key === "Home" ? "first" : "last");
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) {
        openAtSelection();
      } else if (activeOption) {
        commit(activeOption.value);
      }
    }
  };

  const handleOptionPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    // Keep DOM focus on the combobox so aria-activedescendant remains authoritative.
    event.preventDefault();
  };

  return (
    <div className="in-page-select" ref={rootRef}>
      <button
        ref={triggerRef}
        id={`${id}-trigger`}
        className="in-page-select__trigger"
        type="button"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-activedescendant={open ? activeOptionId : undefined}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => {
          if (open) {
            setOpen(false);
            setActiveValue(null);
          } else {
            openAtSelection();
          }
        }}
        onKeyDown={handleKeyDown}
      >
        <span className="in-page-select__value">{selectedOption?.label ?? ""}</span>
        <span className="in-page-select__chevron" aria-hidden="true" />
      </button>

      {open && (
        <div
          className="in-page-select__listbox"
          id={listboxId}
          role="listbox"
          aria-label={label}
        >
          {options.map((option, index) => (
            <div
              key={option.value}
              id={`${optionPrefix}-${index}`}
              className="in-page-select__option"
              role="option"
              aria-selected={option.value === value}
              aria-disabled={option.disabled || undefined}
              data-value={option.value}
              data-active={option.value === activeOption?.value || undefined}
              onPointerDown={handleOptionPointerDown}
              onPointerMove={() => {
                if (!option.disabled) setActiveValue(option.value);
              }}
              onClick={() => {
                if (!option.disabled) commit(option.value);
              }}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}

      <select
        className="in-page-select__native-proxy"
        id={id}
        value={value}
        disabled={disabled}
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

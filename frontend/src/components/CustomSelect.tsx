import { useEffect, useRef, useState } from "react";
import { CaretDown, Check } from "@phosphor-icons/react";

export interface Opt {
  value: string;
  label: string;
}

export default function CustomSelect({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: string;
  options: Opt[];
  onChange: (v: string) => void;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const current = options.find((o) => o.value === value)?.label ?? options[0]?.label ?? "";

  return (
    <div className={`cselect${open ? " open" : ""}`} ref={ref}>
      <button
        type="button"
        className="cselect-btn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span>{current}</span>
        <CaretDown className="chev" size={14} weight="bold" />
      </button>
      {open && (
        <ul className="cselect-list glass" role="listbox">
          {options.map((o) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={o.value === value ? "sel" : ""}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              <span>{o.label}</span>
              {o.value === value && <Check size={14} weight="bold" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

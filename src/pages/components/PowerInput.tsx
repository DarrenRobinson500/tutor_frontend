import { useState, useRef, useEffect } from "react";

interface PowerInputProps {
  value: string;                  // "5^2" or "5" (base only)
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function PowerInput({ value, onChange, onSubmit, disabled, autoFocus }: PowerInputProps) {
  const parseValue = (v: string) =>
    v.includes("^") ? v.split("^") : [v, ""];

  const [base, setBase] = useState(() => parseValue(value)[0]);
  const [exp,  setExp]  = useState(() => parseValue(value)[1]);
  const [mode, setMode] = useState<"base" | "exp">("base");
  const [focused, setFocused] = useState(false);
  const displayRef = useRef<HTMLDivElement>(null);

  // When value changes externally (e.g. reset), re-parse
  useEffect(() => {
    const [b, e] = parseValue(value);
    setBase(b);
    setExp(e);
    setMode("base");
  }, [value]);

  useEffect(() => {
    if (autoFocus) displayRef.current?.focus();
  }, [autoFocus]);

  function emit(b: string, e: string) {
    onChange(e ? `${b}^${e}` : b);
  }

  function handleKeyDown(ev: React.KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;

    if (ev.key === "Enter") { ev.preventDefault(); onSubmit(); return; }

    if (ev.key === "^" || ev.key === "ArrowUp") {
      ev.preventDefault();
      setMode("exp");
      return;
    }

    if (ev.key === "Backspace") {
      ev.preventDefault();
      if (mode === "exp") {
        if (exp.length > 0) {
          const next = exp.slice(0, -1);
          setExp(next);
          emit(base, next);
        } else {
          setMode("base");
        }
      } else {
        const next = base.slice(0, -1);
        setBase(next);
        emit(next, exp);
      }
      return;
    }

    if (/^[A-Za-z0-9]$/.test(ev.key)) {
      ev.preventDefault();
      if (mode === "base") {
        const next = base + ev.key;
        setBase(next);
        emit(next, exp);
      } else {
        const next = exp + ev.key;
        setExp(next);
        emit(base, next);
      }
    }
  }

  const inExp  = mode === "exp";
  const showExp = inExp || exp.length > 0;

  // Blinking cursor block
  const cursor = (
    <span
      style={{
        display: "inline-block",
        width: 2,
        background: "#333",
        marginLeft: 1,
        height: "0.85em",
        verticalAlign: "text-bottom",
        animation: focused ? "power-blink 1s step-end infinite" : "none",
      }}
    />
  );

  return (
    <>
      <style>{`
        @keyframes power-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
      `}</style>

      <div style={{ display: "inline-flex", alignItems: "flex-end", gap: 6 }}>

        {/* ── Display box ── */}
        <div
          ref={displayRef}
          tabIndex={disabled ? undefined : 0}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            border: `2px solid ${focused ? (inExp ? "#0d6efd" : "#333") : "#adb5bd"}`,
            borderRadius: 6,
            padding: "4px 12px",
            background: disabled ? "#f8f9fa" : "#fff9c4",
            fontSize: 22,
            cursor: disabled ? "default" : "text",
            minWidth: 64,
            outline: "none",
            userSelect: "none",
            lineHeight: 1.3,
          }}
        >
          {/* Base */}
          <span style={{ color: (!inExp && base === "") ? "#bbb" : "#000" }}>
            {base || (!inExp ? "?" : "")}
          </span>
          {!inExp && focused && cursor}

          {/* Exponent */}
          {showExp && (
            <span
              style={{
                fontSize: 14,
                position: "relative",
                top: "-0.6em",
                lineHeight: 1,
                color: exp === "" ? "#bbb" : "#000",
              }}
            >
              {exp || (inExp ? "?" : "")}
              {inExp && focused && cursor}
            </span>
          )}
        </div>

        {/* ── xⁿ mode button ── */}
        <button
          type="button"
          disabled={disabled}
          onMouseDown={ev => {
            ev.preventDefault(); // keep focus on display
            setMode("exp");
            displayRef.current?.focus();
          }}
          style={{
            fontSize: 14,
            padding: "4px 9px",
            border: `1px solid ${inExp && focused ? "#0d6efd" : "#999"}`,
            borderRadius: 4,
            background: inExp && focused ? "#e7f0ff" : "#f8f9fa",
            color: inExp && focused ? "#0d6efd" : "#555",
            fontWeight: inExp && focused ? 700 : 400,
            cursor: "pointer",
            transition: "all 0.1s",
          }}
          title="Enter exponent / power (or press ^)"
        >
          x<sup style={{ fontSize: 10 }}>n</sup>
        </button>

      </div>
    </>
  );
}

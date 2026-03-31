import React from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface LatexProps {
  children: string;
}

function renderInlineMath(content: string, key: number | string) {
  try {
    const html = katex.renderToString(content, { displayMode: false, throwOnError: true });
    return <span key={key} dangerouslySetInnerHTML={{ __html: html }} />;
  } catch (err: any) {
    return <span key={key} style={{ color: "red", fontFamily: "monospace" }}>LaTeX error: {err.message}</span>;
  }
}

function renderDisplayMath(content: string, key: number | string) {
  try {
    const html = katex.renderToString(content, { displayMode: true, throwOnError: true });
    return <span key={key} dangerouslySetInnerHTML={{ __html: html }} />;
  } catch (err: any) {
    return <span key={key} style={{ color: "red", fontFamily: "monospace" }}>LaTeX error: {err.message}</span>;
  }
}

// Splits a plain-text string into text and bare LaTeX math segments.
// e.g. "What is \frac{3}{5} + \frac{1}{2}?" →
//   [{type:"text", content:"What is "}, {type:"math", content:"\\frac{3}{5} + \\frac{1}{2}"}, {type:"text", content:"?"}]
function splitBareLatex(text: string): Array<{ type: "text" | "math"; content: string }> {
  if (!text.includes("\\")) return [{ type: "text", content: text }];

  // Split on LaTeX commands with their {} arguments (handles up to 2 levels of nesting)
  const rawParts = text.split(/(\\[a-zA-Z]+(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})*)/g);

  const result: Array<{ type: "text" | "math"; content: string }> = [];
  let i = 0;

  while (i < rawParts.length) {
    const part = rawParts[i];
    if (!part) { i++; continue; }

    if (/^\\[a-zA-Z]/.test(part)) {
      // Merge consecutive math commands connected by operators/spaces
      let math = part;
      let j = i + 1;
      while (j < rawParts.length) {
        const sep = rawParts[j] ?? "";
        const next = rawParts[j + 1] ?? "";
        if (/^[\s+\-*/=^_<>|!:,.()\[\]]*$/.test(sep) && /^\\[a-zA-Z]/.test(next)) {
          math += sep + next;
          j += 2;
        } else {
          break;
        }
      }
      result.push({ type: "math", content: math });
      i = j;
    } else {
      result.push({ type: "text", content: part });
      i++;
    }
  }

  return result;
}

// Renders a text segment (possibly containing bare LaTeX) with optional bold wrapping.
function renderTextSegment(text: string, bold: boolean, key: string | number): React.ReactElement {
  const subParts = splitBareLatex(text);
  const nodes = subParts.map((sp, j) =>
    sp.type === "math"
      ? renderInlineMath(sp.content, `${key}-${j}`)
      : <span key={`${key}-${j}`} style={{ whiteSpace: "pre-wrap" }}>{sp.content}</span>
  );
  if (bold) return <strong key={key}>{nodes}</strong>;
  return <React.Fragment key={key}>{nodes}</React.Fragment>;
}

// Private-use Unicode character used as a placeholder for \$ (escaped dollar sign).
// Replaced before splitting so \$ never acts as a math delimiter.
const DOLLAR_PLACEHOLDER = "\uE000";

export function Latex({ children }: LatexProps) {
  // Replace \$ with placeholder so it is never treated as a math delimiter
  const text = children.replace(/\\\$/g, DOLLAR_PLACEHOLDER);

  // Split on delimited math: $$...$$, $...$, \[...\], \(...\)
  const parts = text.split(/(\${1,2}[\s\S]*?\${1,2}|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g);

  return (
    <>
      {parts.flatMap((part, i) => {
        const trimmed = part.trim();

        // Restore \$ inside math blocks so KaTeX can render a literal dollar sign
        const mathContent = (s: string) => s.replace(new RegExp(DOLLAR_PLACEHOLDER, "g"), "\\$");
        // Restore \$ in text segments as a plain $ character
        const textContent = (s: string) => s.replace(new RegExp(DOLLAR_PLACEHOLDER, "g"), "$");

        // Block math: $$ ... $$ or \[ ... \]
        if (trimmed.startsWith("$$") && trimmed.endsWith("$$")) {
          return [renderDisplayMath(mathContent(trimmed.slice(2, -2)), i)];
        }
        if (trimmed.startsWith("\\[") && trimmed.endsWith("\\]")) {
          return [renderDisplayMath(mathContent(trimmed.slice(2, -2)), i)];
        }

        // Inline math: $ ... $ or \( ... \)
        if (trimmed.startsWith("$") && trimmed.endsWith("$")) {
          return [renderInlineMath(mathContent(trimmed.slice(1, -1)), i)];
        }
        if (trimmed.startsWith("\\(") && trimmed.endsWith("\\)")) {
          return [renderInlineMath(mathContent(trimmed.slice(2, -2)), i)];
        }

        // Plain text — split on **bold** first, then render each segment through LaTeX pipeline
        const tc = textContent(part);
        const boldParts = tc.split(/(\*\*[^*]*\*\*)/g);
        return boldParts.flatMap((bp, j) => {
          const isBold = bp.startsWith("**") && bp.endsWith("**");
          const inner = isBold ? bp.slice(2, -2) : bp;
          return [renderTextSegment(inner, isBold, `${i}-${j}`)];
        });
      })}
    </>
  );
}
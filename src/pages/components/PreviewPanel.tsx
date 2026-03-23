import { useState, useEffect, useRef } from "react";
import { Latex } from "./Latex";
import "katex/dist/katex.min.css";
import { apiFetch } from "../../utils/apiFetch";
import type { PreviewResponse, StudentRecordResponse, KnowledgeItem } from "../../types/PreviewResponse";


interface PreviewPanelBase {
  preview: PreviewResponse | null;
}

/**
 * EDITOR MODE
 * - No student fields allowed
 * - templateContent + onEditorNext required
 */
interface PreviewPanelEditorProps extends PreviewPanelBase {
  mode: "editor";
  templateContent: string;
  onEditorNext: (newPreview: PreviewResponse) => void;

  // explicitly forbidden in editor mode
  templateId?: never;
  studentId?: never;
  onStudentNext?: never;
}

/**
 * STUDENT MODE
 * - templateId + studentId required
 * - onStudentNext required
 * - templateContent/onEditorNext forbidden
 */
interface PreviewPanelStudentProps extends PreviewPanelBase {
  mode: "student";
  templateId: number;
  studentId: number;
  onStudentNext: (result: StudentRecordResponse) => void;

  // explicitly forbidden in student mode
  templateContent?: never;
  onEditorNext?: never;
}

/**
 * UNION OF BOTH MODES
 */
export type PreviewPanelProps =
  | PreviewPanelEditorProps
  | PreviewPanelStudentProps;

export function PreviewPanel({
  preview,
  mode,
  templateContent,
  onEditorNext,
  templateId,
  onStudentNext,
  studentId,
}: PreviewPanelProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [flagged, setFlagged] = useState(false);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [selectedAnswer, setSelectedAnswer] = useState<any>(null);
  const [showIncorrectFeedback, setShowIncorrectFeedback] = useState(false);
  const [backendResult, setBackendResult] = useState<any>(null);
  const [localTemplateId, setLocalTemplateId] = useState<number | null>(null);
  const [textInput, setTextInput] = useState("");
  const [formatError, setFormatError] = useState<string | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const [focusKey, setFocusKey] = useState(0);
  const [multiStepIndex, setMultiStepIndex] = useState(0);

  useEffect(() => {
    if (mode === "student" && templateId !== undefined) {
      console.log("Setting localTemplateId to:", templateId);
      setLocalTemplateId(templateId);
    }
  }, [templateId, mode]);

  // Reset state on any preview change (including YAML edits) — but do NOT focus here.
  useEffect(() => {
    setStartTime(Date.now());
    setSelected(null);
    setIsCorrect(null);
    setFlagged(false);
    setShowIncorrectFeedback(false);
    setSelectedAnswer(null);
    setBackendResult(null);
    setTextInput("");
    setFormatError(null);
    setMultiStepIndex(0);
  }, [preview]);

  // Focus the input only when explicitly triggered by answering and advancing.
  useEffect(() => {
    if (focusKey === 0) return;
    setTimeout(() => textInputRef.current?.focus(), 50);
  }, [focusKey]);

  const safeLatex = (value: any): string => {
    if (value === null || value === undefined) return "";
    if (typeof value === "string" || typeof value === "number") return String(value);
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  };

  async function recordAttempt(answer: any, correct: boolean, helpRequested?: boolean) {
    if (!preview) return null;

    const timeTaken = Date.now() - startTime;

    const res = await apiFetch("/api/questions/record/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id: studentId,
        template_id: localTemplateId,
        params: preview.params,
        question_text: preview.question,
        correct_answer: preview.solution,
        selected_answer: answer?.text ?? null,
        correct,
        time_taken_ms: timeTaken,
        help_requested: helpRequested !== undefined ? helpRequested : flagged,
      }),
    });
    return res.json();
  }

  async function handleIDontKnowMultiStep() {
    if (!multiStep || !activeStep) return;
    setFlagged(true);
    setSelected(0);
    setIsCorrect(false);

    const isLastStep = multiStepIndex === multiStep.steps.length - 1;
    if (isLastStep) {
      if (mode === "student") {
        const result = await recordAttempt({ text: activeStep.answer }, false, true);
        setTimeout(() => { onStudentNext?.(result); }, 1500);
      }
      if (mode === "editor") {
        setTimeout(() => { loadNextEditorPreview(); }, 1500);
      }
    } else {
      setTimeout(() => {
        setMultiStepIndex(i => i + 1);
        setIsCorrect(null);
        setSelected(null);
        setTextInput("");
        setFocusKey(k => k + 1);
      }, 1500);
    }
  }

  async function loadNextEditorPreview() {
    if (!templateContent) return;
    const res = await apiFetch("/api/templates/preview/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: templateContent }),
    });
    const data = await res.json();
    if (data.ok && data.preview) {
      onEditorNext?.(data.preview);
      setFocusKey(k => k + 1);
    }
  }

  async function loadNextStudentPreview() {
    if (!templateId) return;
    const res = await apiFetch("/api/templates/preview/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId }),
    });
    const data = await res.json();
    if (data.ok && data.preview) {
      onStudentNext?.(data.preview);
      setFocusKey(k => k + 1);
    }
  }

  async function handleIDontGetIt() {
    setFlagged(true);

    if (mode === "student") {
      const result = await recordAttempt(selectedAnswer, false);
      setShowIncorrectFeedback(true);
      setBackendResult(result);
    }
  }

  function answersMatch(input: string, correct: any, tolerance = 1e-9): boolean {
    const normalize = (s: any) => String(s).trim().toLowerCase().replace(/\s+/g, "");
    const a = normalize(input);
    const b = normalize(correct);
    if (a === b) return true;

    // If the student entered a fraction, it must be fully simplified
    if (a.includes("/") && !a.includes("x") && !a.includes("×")) {
      const fracParts = a.split("/");
      if (fracParts.length === 2) {
        const fn = Math.abs(parseInt(fracParts[0]));
        const fd = Math.abs(parseInt(fracParts[1]));
        if (!isNaN(fn) && !isNaN(fd) && fd !== 0) {
          const gcdFn = (x: number, y: number): number => y === 0 ? x : gcdFn(y, x % y);
          if (gcdFn(fn, fd) !== 1) return false;
        }
      }
    }

    // Parse a ratio like "1:2" → [1, 2] simplified
    const parseRatio = (s: string): number[] | null => {
      if (!s.includes(":")) return null;
      const parts = s.split(":").map(p => Number(p.trim()));
      if (parts.some(isNaN) || parts.some(p => p <= 0)) return null;
      const gcd = (x: number, y: number): number => y === 0 ? x : gcd(y, x % y);
      const g = parts.reduce(gcd);
      return parts.map(p => p / g);
    };
    const ra = parseRatio(a), rb = parseRatio(b);
    if (ra !== null && rb !== null && ra.length === rb.length) {
      return ra.every((v, i) => Math.abs(v - rb[i]) < 1e-9);
    }

    // Parse a single number, fraction like "3/4", or percentage like "50%"
    const parseFraction = (s: string): number | null => {
      if (s.endsWith("%")) {
        const n = parseFloat(s);
        return isNaN(n) ? null : n / 100;
      }
      if (s.includes("/")) {
        const [num, den] = s.split("/").map(Number);
        return isNaN(num) || isNaN(den) || den === 0 ? null : num / den;
      }
      const n = parseFloat(s);
      return isNaN(n) ? null : n;
    };

    const isPrime = (n: number): boolean => {
      if (!Number.isInteger(n) || n < 2) return false;
      for (let i = 2; i * i <= n; i++) {
        if (n % i === 0) return false;
      }
      return true;
    };

    // Parse a product expression like "2x2x5x5"; returns {product, allPrime}
    const parseProduct = (s: string): { product: number; allPrime: boolean } | null => {
      const parts = s.split(/[x×*]/);
      if (parts.length < 2) return null;
      let product = 1;
      let allPrime = true;
      for (const part of parts) {
        const n = parseFraction(part.trim());
        if (n === null) return null;
        product *= n;
        if (!isPrime(n)) allPrime = false;
      }
      return { product, allPrime };
    };

    const pa = parseProduct(a);
    const pb = parseProduct(b) ?? { product: parseFraction(b) ?? NaN, allPrime: true };

    // If the student entered a product, all factors must be prime
    if (pa !== null) {
      if (!pa.allPrime) return false;
      if (pb.product !== null && !isNaN(pb.product)) {
        return Math.abs(pa.product - pb.product) < 1e-9;
      }
    }

    const na = parseFraction(a), nb = parseFraction(b);
    if (na !== null && nb !== null) return Math.abs(na - nb) <= tolerance;
    return false;
  }

  function checkAnswerFormat(input: string, format: string | null): string | null {
    if (!format) return null;
    const s = input.trim();
    if (format === "fraction" && !s.includes("/"))
      return "Please enter your answer as a fraction, e.g. 3/5";
    if (format === "integer" && !/^-?\d+$/.test(s))
      return "Please enter a whole number, e.g. 42";
    if (format === "decimal" && !/^-?\d+(\.\d+)?$/.test(s))
      return "Please enter a decimal, e.g. 0.75";
    if (format === "ratio" && !/^\d+(\s*:\s*\d+)+$/.test(s))
      return "Please enter your answer as a ratio, e.g. 1:2";
    return null;
  }

  async function handleTextSubmit() {
    const fmtErr = checkAnswerFormat(textInput, answerFormat);
    if (fmtErr) { setFormatError(fmtErr); return; }
    setFormatError(null);

    // Multi-step mode (AlgebraTable with multiple blanks)
    const multiStep = preview?.multi_step;
    if (multiStep?.steps?.length) {
      const step = multiStep.steps[multiStepIndex];
      const correct = answersMatch(textInput, step.answer, step.tolerance ?? 1e-9);
      setSelected(0);
      setIsCorrect(correct);
      if (correct) {
        const isLastStep = multiStepIndex === multiStep.steps.length - 1;
        if (!isLastStep) {
          setTimeout(() => {
            setMultiStepIndex(i => i + 1);
            setIsCorrect(null);
            setSelected(null);
            setTextInput("");
            setFocusKey(k => k + 1);
          }, 800);
        } else {
          if (mode === "student") {
            const result = await recordAttempt({ text: textInput }, true);
            setTimeout(() => { onStudentNext?.(result); }, 1000);
          }
          if (mode === "editor") {
            setTimeout(() => { loadNextEditorPreview(); }, 1000);
          }
        }
      }
      // Incorrect: just show "Incorrect — try again"; student retypes to clear it
      return;
    }

    // Single-answer mode
    if (!correctInputAnswer) return;
    const correct = answersMatch(textInput, correctInputAnswer.text, answerTolerance);
    const answerObj = { text: textInput };
    setSelected(0);
    setIsCorrect(correct);

    if (mode === "student") {
      const result = await recordAttempt(answerObj, correct);
      if (correct) {
        setTimeout(() => { onStudentNext?.(result); }, 1000);
      } else {
        setShowIncorrectFeedback(true);
        setBackendResult(result);
      }
    }
    if (mode === "editor" && correct) {
      setTimeout(() => { loadNextEditorPreview(); }, 1000);
    }
  }

  async function handleAnswerClick(index: number, answer: any) {
    setSelected(index);
    setSelectedAnswer(answer);

    const correct = Boolean(answer.correct);
    setIsCorrect(correct);

    if (mode === "student") {
      const result = await recordAttempt(answer, correct);

      if (correct) {
          setTimeout(() => {
            onStudentNext?.(result);
          }, 1000);
          return;
      } else {
        setShowIncorrectFeedback(true);
        setBackendResult(result);
      }
    }

    if (mode === "editor" && correct) {
      setTimeout(() => {
        loadNextEditorPreview();
      }, 1000);
      return;
    }

  }

  if (!preview) {
    return (
      <div style={{ padding: 12, color: "#888" }}>
        Start typing or load a question to see a preview…
      </div>
    );
  }

  if (Array.isArray(preview.errors) && preview.errors.length > 0) {
    return (
      <div style={{ padding: 12 }}>
        <div style={{ color: "red", marginBottom: 12 }}>
          Backend reported errors:
          <ul>
            {preview.errors.map((e: string, i: number) => (
              <li key={i}>{safeLatex(e)}</li>
            ))}
          </ul>
        </div>

        {preview.question && (
          <div style={{ marginBottom: 12, fontWeight: "bold" }}>
            <Latex>{safeLatex(preview.question)}</Latex>
          </div>
        )}

        {preview.diagram_svg && (
          <div
            dangerouslySetInnerHTML={{ __html: preview.diagram_svg }}
            style={{ marginBottom: 12 }}
          />
        )}
      </div>
    );
  }

  const solution = safeLatex(preview.solution);
  const knowledgeItems: KnowledgeItem[] = preview.knowledge_items ?? [];
  const answers = Array.isArray(preview.answers) ? preview.answers : [];
  const multiStep = preview.multi_step;
  const isMultiStep = Boolean(multiStep?.steps?.length);
  const activeStep = isMultiStep ? multiStep!.steps[multiStepIndex] : null;
  const diagramSvg = activeStep?.svg || preview.diagram_svg;
  // Main question text always shown; per-step question shown below it when present
  const mainQuestion = safeLatex(preview.question);
  const stepQuestion = (isMultiStep && activeStep?.question)
    ? safeLatex(activeStep.question)
    : null;
  const isInputMode = isMultiStep || answers.some((a: any) => a?.input_type === "text");
  const correctInputAnswer = answers.find((a: any) => a?.correct);
  const inputAnswerMeta = answers.find((a: any) => a?.input_type === "text");
  const formatInstruction = inputAnswerMeta?.format_instruction ?? null;
  const answerFormat = inputAnswerMeta?.answer_format ?? null;
  const answerTolerance = inputAnswerMeta?.tolerance ?? 1e-9;

  return (
    <div style={{ padding: 12, fontSize: 18 }}>
      <div style={{ marginBottom: stepQuestion ? 6 : 12 }}>
        <Latex>{mainQuestion}</Latex>
      </div>
      {stepQuestion && (
        <div style={{ marginBottom: 12, fontWeight: "bold" }}>
          <Latex>{stepQuestion}</Latex>
        </div>
      )}

      {diagramSvg && (
        <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
          <div dangerouslySetInnerHTML={{ __html: diagramSvg }} />
        </div>
      )}

      {(isMultiStep || answers.length > 0) && (
        isInputMode ? (
          <div>
            <div className="d-flex gap-2 align-items-center mt-2">
              <input
                type="text"
                className="form-control"
                style={{ maxWidth: 200, backgroundColor: '#fff9c4' }}
                value={textInput}
                onChange={e => {
                  setTextInput(e.target.value);
                  setFormatError(null);
                  if (isCorrect === false) {
                    setSelected(null);
                    setIsCorrect(null);
                  }
                }}
                onKeyDown={e => { if (e.key === "Enter") handleTextSubmit(); }}
                disabled={isCorrect === true}
                ref={textInputRef}
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={handleTextSubmit}
                disabled={isCorrect === true}
              >
                Submit
              </button>
              {isMultiStep && (
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={handleIDontKnowMultiStep}
                  disabled={isCorrect === true}
                >
                  I don't know
                </button>
              )}
            </div>
            {formatError && (
              <div className="text-danger mt-1" style={{ fontSize: 13 }}>{formatError}</div>
            )}
            {formatInstruction && (
              <div className="text-muted mt-1" style={{ fontSize: 13 }}>
                Input format: <code>{formatInstruction}</code>
              </div>
            )}
          </div>
        ) : (
          <div className="d-flex flex-row flex-wrap gap-2">
            {answers.filter(Boolean).map((a: any, i: number) => {
              const isSelected = selected === i;
              const btnClass = `btn btn-sm w-auto ${
                isSelected
                  ? isCorrect
                    ? "btn-success"
                    : "btn-danger"
                  : "btn-outline-primary"
              }`;

              if (a?.diagram_svg) {
                return (
                  <button
                    key={i}
                    className={btnClass}
                    style={{ padding: "4px" }}
                    onClick={() => handleAnswerClick(i, a)}
                    dangerouslySetInnerHTML={{ __html: a.diagram_svg }}
                  />
                );
              }

              return (
                <button
                  key={i}
                  className={btnClass}
                  style={{ minWidth: "90px" }}
                  onClick={() => handleAnswerClick(i, a)}
                >
                  <Latex>{safeLatex(a?.text)}</Latex>
                </button>
              );
            })}
          </div>
        )
      )}

      {selected !== null && (
        <div className="mt-3" style={{ fontWeight: "bold", fontSize: 18 }}>
          {isCorrect ? "Correct!" : "Incorrect — try again"}
        </div>
      )}

      {selected !== null && !isCorrect && isMultiStep && activeStep && (
        <div
          className="mt-2 p-2"
          style={{ background: "#f8f9fa", borderLeft: "4px solid #dc3545", fontSize: 15 }}
        >
          {activeStep.solution
            ? <Latex>{activeStep.solution}</Latex>
            : <>The answer is <strong>{activeStep.answer}</strong></>
          }
        </div>
      )}

      {selected !== null && !isCorrect && !isMultiStep && (solution || (isInputMode && correctInputAnswer)) && (
        <>
          <div
            className="mt-2 p-2"
            style={{
              background: "#f8f9fa",
              borderLeft: "4px solid #dc3545",
              fontSize: 15,
              whiteSpace: "pre-wrap",
            }}
          >
            {solution
              ? <Latex>{solution}</Latex>
              : <span>The correct answer is <strong>{correctInputAnswer?.text}</strong></span>
            }
          </div>

          {knowledgeItems.length > 0 && (
            <div className="mt-3">
              {knowledgeItems.map(k => (
                <div
                  key={k.id}
                  className="p-3 mb-2 rounded"
                  style={{ background: "#fffde7", border: "1px solid #ffe082", fontSize: 15 }}
                >
                  {k.title && (
                    <div className="fw-semibold mb-1" style={{ fontSize: 14 }}>
                      <Latex>{k.title}</Latex>
                    </div>
                  )}
                  {k.text && (
                    <div className="mb-1" style={{ lineHeight: 1.6 }}>
                      <Latex>{k.text}</Latex>
                    </div>
                  )}
                  {k.diagram_svg && (
                    <div
                      className="text-center my-2"
                      dangerouslySetInnerHTML={{ __html: k.diagram_svg }}
                    />
                  )}
                  {k.text_2 && (
                    <div style={{ lineHeight: 1.6 }}>
                      <Latex>{k.text_2}</Latex>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {mode === "student" && backendResult && (
                <>
                  <button
                    className="btn btn-primary mt-2"
                    onClick={() => onStudentNext?.(backendResult)}
                  >
                    Next
                  </button>
                  <button
                    className="btn btn-sm btn-warning mt-2 ms-2"
                    onClick={handleIDontGetIt}
                  >
                    I don't get it
                  </button>
                </>
              )}
        </>
      )}

      {flagged && (
        <div className="alert alert-info mt-2 p-2">
          Added to tutor review list
        </div>
      )}
    </div>
  );
}
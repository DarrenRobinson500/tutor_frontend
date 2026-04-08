import { useEffect, useRef, useState } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { apiFetch } from "../../utils/apiFetch";
import { PreviewPanel } from "./PreviewPanel";
import type { PreviewResponse, StudentRecordResponse } from "../../types/PreviewResponse";

const TOPIC = "session";

type Mode = "learn" | "assessment" | "manual";

interface SessionEvent {
  topic: string;
  type: "set_template";
  template_id: number | null;
  session_id?: number;
  learn_mode?: boolean;
}

interface QuestionPanelProps {
  isTutor: boolean;
  roomName: string;
  studentId?: number;
}

interface Template {
  id: number;
  title: string;
  skill_detail_description?: string | null;
  grade?: string | null;
}

interface LearnQuestion {
  template_id: number;
  preview: PreviewResponse;
  skill_code: string;
  skill_description: string;
  difficulty: string;
  loop: number;
  loop_remaining: number;
  loop1_correct: number;
  loop1_total: number;
  mode: string;
}

interface AssessmentContext {
  template_id: number | null;
  skill?: string;
  skill_index?: number;
  total_skills?: number;
  difficulty?: string;
  complete?: boolean;
  error?: string;
}

const DIFFICULTY_BADGE: Record<string, string> = {
  easy: "success",
  medium: "warning",
  hard: "danger",
};

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export function QuestionPanel({ isTutor, roomName, studentId }: QuestionPanelProps) {
  const room = useRoomContext();

  // Shared: the template the tutor has pushed to the room (used for non-learn display)
  const [activeTemplateId, setActiveTemplateId] = useState<number | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [search, setSearch] = useState("");

  const [mode, setMode] = useState<Mode>("learn");
  const [actionLoading, setActionLoading] = useState(false);

  // ── Tutor learn mode ───────────────────────────────────────────────────────
  const [learnSessionId, setLearnSessionId] = useState<number | null>(null);
  const [learnQuestion, setLearnQuestion] = useState<LearnQuestion | null>(null);
  const [learnComplete, setLearnComplete] = useState(false);
  const [learnError, setLearnError] = useState<string | null>(null);

  // ── Student learn mode ─────────────────────────────────────────────────────
  // Separate from activeTemplateId so advancing questions doesn't trigger the
  // activeTemplateId fetch-effect (which causes loadingPreview flicker / null preview).
  const [studentLearnMode, setStudentLearnMode] = useState(false);
  const [studentSessionId, setStudentSessionId] = useState<number | null>(null);
  const [studentTemplateId, setStudentTemplateId] = useState<number | null>(null);
  const [studentPreview, setStudentPreview] = useState<PreviewResponse | null>(null);
  const [studentLearnComplete, setStudentLearnComplete] = useState(false);
  const [studentLoadingPreview, setStudentLoadingPreview] = useState(false);

  // ── Assessment mode (tutor) ────────────────────────────────────────────────
  const [assessContext, setAssessContext] = useState<AssessmentContext | null>(null);

  const initialised = useRef(false);

  // Restore active template on reconnect
  useEffect(() => {
    apiFetch(`/api/sessions/state/?room_name=${encodeURIComponent(roomName)}`)
      .then((r) => r.json())
      .then((data) => { if (data.active_template_id) setActiveTemplateId(data.active_template_id); })
      .catch(() => {});
  }, [roomName]);

  // Auto-start learn mode for tutor on mount
  useEffect(() => {
    if (!isTutor || initialised.current) return;
    initialised.current = true;
    startLearnMode();
  }, [isTutor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load template list for manual mode
  useEffect(() => {
    if (!isTutor) return;
    apiFetch("/api/templates/?page_size=500")
      .then((r) => r.json())
      .then((data) => setTemplates(Array.isArray(data) ? data : data.results ?? []))
      .catch(() => {});
  }, [isTutor]);

  // Listen for session events (template pushes from tutor → student)
  useEffect(() => {
    const handleData = (payload: Uint8Array, _p: any, _k: any, topic?: string) => {
      if (topic !== TOPIC) return;
      try {
        const event: SessionEvent = JSON.parse(new TextDecoder().decode(payload));
        if (event.type !== "set_template") return;

        if (!isTutor) {
          // Student: receive the initial template + learn session info
          const newLearnMode = !!event.learn_mode;
          setStudentLearnMode(newLearnMode);
          setStudentSessionId(event.session_id ?? null);
          setStudentLearnComplete(false);

          if (newLearnMode && event.template_id) {
            // Fetch preview for the first question
            setStudentTemplateId(event.template_id);
            setStudentLoadingPreview(true);
            apiFetch(`/api/templates/${event.template_id}/preview/`)
              .then((r) => r.json())
              .then((data) => setStudentPreview(data))
              .catch(() => setStudentPreview(null))
              .finally(() => setStudentLoadingPreview(false));
          } else {
            // Non-learn: fall through to activeTemplateId path
            setActiveTemplateId(event.template_id);
          }
        } else {
          // Tutor receives echo from student (student advanced question)
          setActiveTemplateId(event.template_id);
          if (event.learn_mode && event.template_id) {
            // Fetch updated preview for the tutor side
            apiFetch(`/api/templates/${event.template_id}/preview/`)
              .then((r) => r.json())
              .then((data) => setPreview(data))
              .catch(() => {});
          }
        }
      } catch {}
    };
    room.on(RoomEvent.DataReceived, handleData);
    return () => { room.off(RoomEvent.DataReceived, handleData); };
  }, [room, isTutor]);

  // Fetch preview for non-learn modes (tutor manual, or student non-learn)
  useEffect(() => {
    if (!activeTemplateId) { setPreview(null); return; }
    if (!isTutor || mode === "manual") {
      setLoadingPreview(true);
      apiFetch(`/api/templates/${activeTemplateId}/preview/`)
        .then((r) => r.json())
        .then(setPreview)
        .catch(() => setPreview(null))
        .finally(() => setLoadingPreview(false));
    }
  }, [activeTemplateId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Push template to student + persist on server ───────────────────────────

  const pushTemplate = async (
    templateId: number | null,
    opts?: { sessionId?: number; learnMode?: boolean }
  ) => {
    const event: SessionEvent = {
      topic: TOPIC,
      type: "set_template",
      template_id: templateId,
      session_id: opts?.sessionId,
      learn_mode: opts?.learnMode,
    };
    room.localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify(event)),
      { reliable: true, topic: TOPIC }
    );
    await apiFetch("/api/sessions/set_template/", {
      method: "POST",
      body: JSON.stringify({ room_name: roomName, template_id: templateId }),
    }).catch(() => {});
    setActiveTemplateId(templateId);
  };

  // ── Tutor: start learn mode ────────────────────────────────────────────────

  async function startLearnMode() {
    setMode("learn");
    setLearnComplete(false);
    setLearnError(null);
    setLearnQuestion(null);
    setLearnSessionId(null);
    setActionLoading(true);
    try {
      const data = await apiFetch("/api/sessions/learn_mode/", {
        method: "POST",
        body: JSON.stringify({ room_name: roomName }),
      }).then((r) => r.json());

      if (data.error) { setLearnError(data.error); return; }

      setLearnSessionId(data.session_id);
      const q: LearnQuestion = data.question;
      setLearnQuestion(q);
      setPreview(q.preview);
      await pushTemplate(q.template_id, { sessionId: data.session_id, learnMode: true });
    } finally {
      setActionLoading(false);
    }
  }

  // ── Student: answer a learn-mode question ──────────────────────────────────

  async function submitStudentAnswer(result: StudentRecordResponse) {
    if (!studentSessionId || !studentTemplateId) return;
    try {
      const data = await apiFetch(`/api/tests/${studentSessionId}/answer/`, {
        method: "POST",
        body: JSON.stringify({
          template_id: studentTemplateId,
          correct: result.correct ?? false,
        }),
      }).then((r) => r.json());

      if (data.complete) {
        setStudentLearnComplete(true);
        // Notify tutor session is done
        room.localParticipant.publishData(
          new TextEncoder().encode(JSON.stringify({
            topic: TOPIC, type: "set_template", template_id: null, learn_mode: true,
          })),
          { reliable: true, topic: TOPIC }
        );
        return;
      }

      const q: LearnQuestion = data.question;
      // Update student's preview directly from API response — no extra fetch needed
      setStudentTemplateId(q.template_id);
      setStudentPreview(q.preview);

      // Tell tutor the question has advanced
      const event: SessionEvent = {
        topic: TOPIC,
        type: "set_template",
        template_id: q.template_id,
        session_id: studentSessionId,
        learn_mode: true,
      };
      room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(event)),
        { reliable: true, topic: TOPIC }
      );
      await apiFetch("/api/sessions/set_template/", {
        method: "POST",
        body: JSON.stringify({ room_name: roomName, template_id: q.template_id }),
      }).catch(() => {});
    } catch (err) {
      console.error("submitStudentAnswer failed:", err);
    }
  }

  // ── Tutor: assessment mode ─────────────────────────────────────────────────

  async function requestAssessmentQuestion(result: "correct" | "wrong" | null) {
    setActionLoading(true);
    try {
      const data: AssessmentContext = await apiFetch("/api/sessions/next_question/", {
        method: "POST",
        body: JSON.stringify({ room_name: roomName, mode: "assessment", result }),
      }).then((r) => r.json());

      setAssessContext(data);
      if (data.template_id) await pushTemplate(data.template_id);
      else if (!data.complete) await pushTemplate(null);
    } finally {
      setActionLoading(false);
    }
  }

  async function switchToAssessment() {
    setMode("assessment");
    setLearnQuestion(null);
    setLearnSessionId(null);
    setLearnComplete(false);
    setLearnError(null);
    await requestAssessmentQuestion(null);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  const filteredTemplates = templates.filter((t) => {
    const q = search.toLowerCase();
    return (
      t.title?.toLowerCase().includes(q) ||
      t.skill_detail_description?.toLowerCase().includes(q) ||
      t.grade?.toLowerCase().includes(q)
    );
  });

  const showStudentLearn = !isTutor && studentLearnMode && !!studentSessionId && !!studentTemplateId;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Tutor controls ── */}
      {isTutor && (
        <div className="border-bottom" style={{ flexShrink: 0, padding: "8px", background: "#f8f9fa" }}>
          {/* Mode toggle */}
          <div className="d-flex gap-2 mb-2">
            <button
              className={`btn btn-sm ${mode === "learn" ? "btn-primary" : "btn-outline-primary"}`}
              onClick={startLearnMode}
              disabled={actionLoading}
            >
              Learn
            </button>
            <button
              className={`btn btn-sm ${mode === "assessment" ? "btn-primary" : "btn-outline-primary"}`}
              onClick={switchToAssessment}
              disabled={actionLoading}
            >
              Assessment
            </button>
            <button
              className={`btn btn-sm ${mode === "manual" ? "btn-secondary" : "btn-outline-secondary"}`}
              onClick={() => { setMode("manual"); setLearnQuestion(null); setAssessContext(null); pushTemplate(null); }}
            >
              Manual
            </button>
          </div>

          {/* Learn mode context */}
          {mode === "learn" && !learnError && !learnComplete && learnQuestion && (
            <div className="mb-2 px-1">
              <div className="d-flex align-items-center gap-2 mb-1">
                <span className="badge bg-success" style={{ fontSize: 11 }}>
                  Loop {learnQuestion.loop} of 2
                </span>
                <span className="text-muted" style={{ fontSize: 12 }}>
                  {learnQuestion.loop_remaining} question{learnQuestion.loop_remaining !== 1 ? "s" : ""} left
                </span>
              </div>
              <div className="d-flex align-items-center gap-2">
                <span className="fw-semibold" style={{ fontSize: 13 }}>{learnQuestion.skill_description}</span>
                <span
                  className={`badge bg-${DIFFICULTY_BADGE[learnQuestion.difficulty] ?? "secondary"}`}
                  style={{ fontSize: 11 }}
                >
                  {DIFFICULTY_LABEL[learnQuestion.difficulty] ?? learnQuestion.difficulty}
                </span>
              </div>
            </div>
          )}
          {mode === "learn" && learnError && (
            <div className="text-muted mb-2" style={{ fontSize: 12 }}>{learnError}</div>
          )}
          {mode === "learn" && learnComplete && (
            <div className="text-success mb-2 fw-semibold" style={{ fontSize: 12 }}>
              Learning complete for this week!
            </div>
          )}

          {/* Assessment context */}
          {mode === "assessment" && assessContext && !assessContext.error && !assessContext.complete && (
            <div className="mb-2 px-1" style={{ fontSize: 12, lineHeight: 1.6 }}>
              <span className="fw-semibold">{assessContext.skill}</span>
              <span className="text-muted ms-2">
                Skill {(assessContext.skill_index ?? 0) + 1}/{assessContext.total_skills}
                {" · "}{DIFFICULTY_LABEL[assessContext.difficulty ?? ""] ?? assessContext.difficulty}
              </span>
            </div>
          )}
          {mode === "assessment" && assessContext?.error && (
            <div className="text-danger mb-2" style={{ fontSize: 12 }}>{assessContext.error}</div>
          )}
          {mode === "assessment" && assessContext?.complete && (
            <div className="text-success mb-2 fw-semibold" style={{ fontSize: 12 }}>
              Assessment complete — all {assessContext.total_skills} skills covered.
            </div>
          )}

          {/* Assessment Correct / Wrong */}
          {mode === "assessment" && !assessContext?.complete && activeTemplateId && (
            <div className="d-flex gap-2 mb-1">
              <button className="btn btn-sm btn-success" disabled={actionLoading}
                onClick={() => requestAssessmentQuestion("correct")}>✓ Correct</button>
              <button className="btn btn-sm btn-danger" disabled={actionLoading}
                onClick={() => requestAssessmentQuestion("wrong")}>✗ Wrong</button>
              {actionLoading && <span className="spinner-border spinner-border-sm text-secondary align-self-center ms-1" />}
            </div>
          )}

          {/* Manual: template picker */}
          {mode === "manual" && (
            <div style={{ maxHeight: 160, overflowY: "auto" }}>
              <div className="d-flex gap-2 mb-2">
                <input
                  className="form-control form-control-sm"
                  placeholder="Search templates…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {activeTemplateId && (
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => pushTemplate(null)}>Clear</button>
                )}
              </div>
              {filteredTemplates.slice(0, 50).map((t) => (
                <button
                  key={t.id}
                  className={`d-block w-100 text-start btn btn-sm mb-1 ${activeTemplateId === t.id ? "btn-primary" : "btn-outline-secondary"}`}
                  style={{ fontSize: 12 }}
                  onClick={() => pushTemplate(t.id)}
                >
                  {t.title}
                  {t.grade && <span className="text-muted ms-1">· Yr {t.grade}</span>}
                </button>
              ))}
              {filteredTemplates.length === 0 && (
                <div className="text-muted" style={{ fontSize: 12 }}>No templates found.</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Question display ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>

        {/* Student: learn complete */}
        {!isTutor && studentLearnComplete && (
          <div className="text-success text-center mt-4 fw-semibold" style={{ fontSize: 15 }}>
            Learning complete for this week!
          </div>
        )}

        {/* Student: learn mode question */}
        {showStudentLearn && !studentLearnComplete && (
          <>
            {studentLoadingPreview && (
              <div className="text-center mt-4">
                <div className="spinner-border spinner-border-sm text-primary" role="status" />
              </div>
            )}
            {!studentLoadingPreview && studentPreview && studentId != null && (
              <PreviewPanel
                mode="student"
                templateId={studentTemplateId}
                studentId={studentId}
                preview={studentPreview}
                onStudentNext={submitStudentAnswer}
              />
            )}
          </>
        )}

        {/* Tutor / non-learn student view */}
        {!showStudentLearn && !studentLearnComplete && (
          <>
            {(actionLoading || loadingPreview) && !preview && (
              <div className="text-center mt-4">
                <div className="spinner-border spinner-border-sm text-primary" role="status" />
              </div>
            )}
            {!actionLoading && !loadingPreview && !activeTemplateId && (
              <div className="text-muted text-center mt-4" style={{ fontSize: 14 }}>
                {isTutor
                  ? mode === "manual"
                    ? "Select a template above to push a question."
                    : mode === "learn" && learnComplete
                      ? "Learning complete for this week."
                      : mode === "learn" && learnError
                        ? learnError
                        : "Loading first question…"
                  : "Waiting for tutor to send a question…"}
              </div>
            )}
            {!loadingPreview && activeTemplateId && preview && (
              <PreviewPanel
                mode="editor"
                preview={preview}
                templateContent=""
                onEditorNext={(newPreview) => setPreview(newPreview)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

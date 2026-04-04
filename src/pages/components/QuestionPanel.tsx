import { useEffect, useRef, useState } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { apiFetch } from "../../utils/apiFetch";
import { PreviewPanel } from "./PreviewPanel";
import type { PreviewResponse } from "../../types/PreviewResponse";

const TOPIC = "session";

type Mode = "focus_area" | "assessment" | "manual";

interface SessionEvent {
  topic: string;
  type: "set_template";
  template_id: number | null;
}

interface QuestionPanelProps {
  isTutor: boolean;
  roomName: string;
}

interface Template {
  id: number;
  title: string;
  skill_detail_description?: string | null;
  grade?: string | null;
}

interface QuestionContext {
  template_id: number | null;
  // focus_area fields
  focus_area?: string;
  focus_index?: number;
  focus_total?: number;
  correct_streak?: number;
  // assessment fields
  skill?: string;
  skill_index?: number;
  total_skills?: number;
  // shared
  difficulty?: string;
  complete?: boolean;
  error?: string;
}

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export function QuestionPanel({ isTutor, roomName }: QuestionPanelProps) {
  const room = useRoomContext();
  const [activeTemplateId, setActiveTemplateId] = useState<number | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [search, setSearch] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [mode, setMode] = useState<Mode>("focus_area");
  const [context, setContext] = useState<QuestionContext | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const initialised = useRef(false);

  // Load session state on mount (for reconnects)
  useEffect(() => {
    apiFetch(`/api/sessions/state/?room_name=${encodeURIComponent(roomName)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.active_template_id) setActiveTemplateId(data.active_template_id);
      })
      .catch(() => {});
  }, [roomName]);

  // Auto-start focus_area mode for tutor on mount
  useEffect(() => {
    if (!isTutor || initialised.current) return;
    initialised.current = true;
    requestNextQuestion("focus_area", null);
  }, [isTutor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load template list for manual mode
  useEffect(() => {
    if (!isTutor) return;
    apiFetch("/api/templates/?page_size=500")
      .then((r) => r.json())
      .then((data) => setTemplates(Array.isArray(data) ? data : data.results ?? []))
      .catch(() => {});
  }, [isTutor]);

  // Listen for incoming session events (student side)
  useEffect(() => {
    const handleData = (payload: Uint8Array, _p: any, _k: any, topic?: string) => {
      if (topic !== TOPIC) return;
      try {
        const event: SessionEvent = JSON.parse(new TextDecoder().decode(payload));
        if (event.type === "set_template") setActiveTemplateId(event.template_id);
      } catch {}
    };
    room.on(RoomEvent.DataReceived, handleData);
    return () => { room.off(RoomEvent.DataReceived, handleData); };
  }, [room]);

  // Fetch preview when activeTemplateId changes
  useEffect(() => {
    if (!activeTemplateId) { setPreview(null); return; }
    setLoadingPreview(true);
    apiFetch(`/api/templates/${activeTemplateId}/preview/`)
      .then((r) => r.json())
      .then(setPreview)
      .catch(() => setPreview(null))
      .finally(() => setLoadingPreview(false));
  }, [activeTemplateId]);

  const pushTemplate = async (templateId: number | null) => {
    const event: SessionEvent = { topic: TOPIC, type: "set_template", template_id: templateId };
    const data = new TextEncoder().encode(JSON.stringify(event));
    room.localParticipant.publishData(data, { reliable: true, topic: TOPIC });
    await apiFetch("/api/sessions/set_template/", {
      method: "POST",
      body: JSON.stringify({ room_name: roomName, template_id: templateId }),
    }).catch(() => {});
    setActiveTemplateId(templateId);
  };

  async function requestNextQuestion(targetMode: Mode, result: "correct" | "wrong" | null) {
    if (targetMode === "manual") {
      setMode("manual");
      setContext(null);
      return;
    }
    setActionLoading(true);
    try {
      const data: QuestionContext = await apiFetch("/api/sessions/next_question/", {
        method: "POST",
        body: JSON.stringify({ room_name: roomName, mode: targetMode, result }),
      }).then((r) => r.json());

      setMode(targetMode);
      setContext(data);
      if (data.template_id) await pushTemplate(data.template_id);
      else if (!data.complete) await pushTemplate(null);
    } finally {
      setActionLoading(false);
    }
  }

  const filteredTemplates = templates.filter((t) => {
    const q = search.toLowerCase();
    return (
      t.title?.toLowerCase().includes(q) ||
      t.skill_detail_description?.toLowerCase().includes(q) ||
      t.grade?.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Tutor controls ── */}
      {isTutor && (
        <div
          className="border-bottom"
          style={{ flexShrink: 0, padding: "8px", background: "#f8f9fa" }}
        >
          {/* Mode toggle */}
          <div className="d-flex gap-2 mb-2">
            <button
              className={`btn btn-sm ${mode === "focus_area" ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => requestNextQuestion("focus_area", null)}
              disabled={actionLoading}
            >
              Focus Area
            </button>
            <button
              className={`btn btn-sm ${mode === "assessment" ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => requestNextQuestion("assessment", null)}
              disabled={actionLoading}
            >
              Assessment
            </button>
            <button
              className={`btn btn-sm ${mode === "manual" ? "btn-secondary" : "btn-outline-secondary"}`}
              onClick={() => requestNextQuestion("manual", null)}
            >
              Manual
            </button>
          </div>

          {/* Context info */}
          {mode !== "manual" && context && !context.error && !context.complete && (
            <div className="mb-2 px-1" style={{ fontSize: 12, lineHeight: 1.6 }}>
              {mode === "focus_area" && (
                <>
                  <span className="fw-semibold">{context.focus_area}</span>
                  <span className="text-muted ms-2">
                    Area {(context.focus_index ?? 0) + 1}/{context.focus_total}
                    {" · "}streak {context.correct_streak}/3
                    {" · "}{DIFFICULTY_LABEL[context.difficulty ?? ""] ?? context.difficulty}
                  </span>
                </>
              )}
              {mode === "assessment" && (
                <>
                  <span className="fw-semibold">{context.skill}</span>
                  <span className="text-muted ms-2">
                    Skill {(context.skill_index ?? 0) + 1}/{context.total_skills}
                    {" · "}{DIFFICULTY_LABEL[context.difficulty ?? ""] ?? context.difficulty}
                  </span>
                </>
              )}
            </div>
          )}

          {context?.error && (
            <div className="text-danger mb-2" style={{ fontSize: 12 }}>{context.error}</div>
          )}

          {context?.complete && (
            <div className="text-success mb-2 fw-semibold" style={{ fontSize: 12 }}>
              Assessment complete — all {context.total_skills} skills covered.
            </div>
          )}

          {/* Correct / Wrong buttons */}
          {mode !== "manual" && !context?.complete && activeTemplateId && (
            <div className="d-flex gap-2 mb-1">
              <button
                className="btn btn-sm btn-success"
                disabled={actionLoading}
                onClick={() => requestNextQuestion(mode, "correct")}
              >
                ✓ Correct
              </button>
              <button
                className="btn btn-sm btn-danger"
                disabled={actionLoading}
                onClick={() => requestNextQuestion(mode, "wrong")}
              >
                ✗ Wrong
              </button>
              {actionLoading && (
                <span className="spinner-border spinner-border-sm text-secondary align-self-center ms-1" />
              )}
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
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => pushTemplate(null)}>
                    Clear
                  </button>
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
        {loadingPreview && (
          <div className="text-center mt-4">
            <div className="spinner-border spinner-border-sm text-primary" role="status" />
          </div>
        )}
        {!loadingPreview && !activeTemplateId && (
          <div className="text-muted text-center mt-4" style={{ fontSize: 14 }}>
            {isTutor
              ? mode === "manual"
                ? "Select a template above to push a question."
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
      </div>
    </div>
  );
}

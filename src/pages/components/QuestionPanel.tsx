import { useEffect, useRef, useState } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { apiFetch } from "../../utils/apiFetch";
import { PreviewPanel } from "./PreviewPanel";
import type { PreviewResponse } from "../../types/PreviewResponse";

const TOPIC = "session";

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

export function QuestionPanel({ isTutor, roomName }: QuestionPanelProps) {
  const room = useRoomContext();
  const [activeTemplateId, setActiveTemplateId] = useState<number | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [search, setSearch] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Load session state on mount (for reconnects)
  useEffect(() => {
    apiFetch(`/api/sessions/state/?room_name=${encodeURIComponent(roomName)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.active_template_id) {
          setActiveTemplateId(data.active_template_id);
        }
      })
      .catch(() => {});
  }, [roomName]);

  // Load template list for tutor
  useEffect(() => {
    if (!isTutor) return;
    apiFetch("/api/templates/?page_size=500")
      .then((r) => r.json())
      .then((data) => setTemplates(Array.isArray(data) ? data : data.results ?? []))
      .catch(() => {});
  }, [isTutor]);

  // Listen for incoming session events
  useEffect(() => {
    const handleData = (
      payload: Uint8Array,
      _participant: any,
      _kind: any,
      topic?: string
    ) => {
      if (topic !== TOPIC) return;
      try {
        const event: SessionEvent = JSON.parse(new TextDecoder().decode(payload));
        if (event.type === "set_template") {
          setActiveTemplateId(event.template_id);
        }
      } catch {}
    };
    room.on(RoomEvent.DataReceived, handleData);
    return () => { room.off(RoomEvent.DataReceived, handleData); };
  }, [room]);

  // Fetch preview when activeTemplateId changes
  useEffect(() => {
    if (!activeTemplateId) {
      setPreview(null);
      return;
    }
    setLoadingPreview(true);
    apiFetch(`/api/templates/${activeTemplateId}/preview/`)
      .then((r) => r.json())
      .then((data) => setPreview(data))
      .catch(() => setPreview(null))
      .finally(() => setLoadingPreview(false));
  }, [activeTemplateId]);

  const pushTemplate = async (templateId: number | null) => {
    // Broadcast to remote participant
    const event: SessionEvent = { topic: TOPIC, type: "set_template", template_id: templateId };
    const data = new TextEncoder().encode(JSON.stringify(event));
    room.localParticipant.publishData(data, { reliable: true, topic: TOPIC });

    // Save to backend
    await apiFetch(`/api/sessions/set_template/`, {
      method: "POST",
      body: JSON.stringify({ room_name: roomName, template_id: templateId }),
    }).catch(() => {});

    setActiveTemplateId(templateId);
  };

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
      {/* Tutor: template picker */}
      {isTutor && (
        <div
          className="border-bottom"
          style={{ flexShrink: 0, padding: "8px", background: "#f8f9fa", maxHeight: 220, overflowY: "auto" }}
        >
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

      {/* Question display */}
      <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {loadingPreview && (
          <div className="text-center mt-4">
            <div className="spinner-border spinner-border-sm text-primary" role="status" />
          </div>
        )}
        {!loadingPreview && !activeTemplateId && (
          <div className="text-muted text-center mt-4" style={{ fontSize: 14 }}>
            {isTutor ? "Select a template above to push a question." : "Waiting for tutor to send a question…"}
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

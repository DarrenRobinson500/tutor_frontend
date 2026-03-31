import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { apiFetch } from "../utils/apiFetch";

interface Skill {
  id: number;
  code: string;
  description: string;
  children_count: number;
  detail?: string;
}

interface TemplateData {
  id: number;
  name: string;
  subject: string;
  grade: string;
  difficulty: string;
  skill: number | null;
  content: string;
}

function extractQuestion(content: string): string {
  if (!content) return "";
  // Try: question: "some text" or question: some text (same line)
  const inline = content.match(/^question:\s*["']?(.+?)["']?\s*$/m);
  if (inline) return inline[1];
  // Try: question:\n  text: "some text"
  const textKey = content.match(/^question:\s*\n\s+text:\s*["']?(.+?)["']?\s*$/m);
  if (textKey) return textKey[1];
  return "";
}

const GRADES = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

export function TemplateMetadataPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [template, setTemplate] = useState<TemplateData | null>(null);
  const [grade, setGrade] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [subject, setSubject] = useState("");
  const [selectedSkillId, setSelectedSkillId] = useState<number | null>(null);
  const [selectedSkillDesc, setSelectedSkillDesc] = useState<string>("");
  const [selectedSkillDetail, setSelectedSkillDetail] = useState<string | null>(null);

  // Skill browser state
  const [breadcrumb, setBreadcrumb] = useState<Skill[]>([]); // ancestors navigated into
  const [children, setChildren] = useState<Skill[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Load template
  useEffect(() => {
    if (!id) return;
    apiFetch(`/api/templates/${id}/`)
      .then(r => r.json())
      .then((data: TemplateData) => {
        setTemplate(data);
        setGrade(data.grade ?? "");
        setDifficulty(data.difficulty ?? "");
        setSubject(data.subject ?? "");
        setSelectedSkillId(data.skill ?? null);
      });
  }, [id]);

  // Once template is loaded: if it has a skill, load ancestors + that level's children.
  // Otherwise load root children. Single effect avoids the race condition where
  // a concurrent loadChildren(null) could overwrite the correct children list.
  useEffect(() => {
    if (!template) return;
    if (!template.skill) {
      loadChildren(null);
      return;
    }
    Promise.all([
      apiFetch(`/api/skills/${template.skill}/`).then(r => r.json()),
      apiFetch(`/api/skills/${template.skill}/parents/`).then(r => r.json()),
    ]).then(([skillData, parents]: [Skill, Skill[]]) => {
      setSelectedSkillDesc(skillData.description);
      setSelectedSkillDetail(skillData.detail ?? null);
      setBreadcrumb(parents);
      const parentId = parents.length > 0 ? parents[parents.length - 1].id : null;
      loadChildren(parentId);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template?.skill]);

  function loadChildren(parentId: number | null) {
    setLoadingSkills(true);
    const url = parentId == null
      ? "/api/skills/"
      : `/api/skills/?parent=${parentId}`;
    apiFetch(url)
      .then(r => r.json())
      .then((data: Skill[]) => {
        setChildren(data);
        setLoadingSkills(false);
      });
  }

  function drillDown(skill: Skill) {
    if (skill.children_count > 0) {
      setBreadcrumb(prev => [...prev, skill]);
      loadChildren(skill.id);
    } else {
      // Leaf node — select it
      setSelectedSkillId(skill.id);
      setSelectedSkillDesc(skill.description);
      setSelectedSkillDetail(skill.detail ?? null);
    }
  }

  function navigateBreadcrumb(index: number) {
    // index = -1 means root
    if (index === -1) {
      setBreadcrumb([]);
      loadChildren(null);
    } else {
      const crumb = breadcrumb[index];
      setBreadcrumb(prev => prev.slice(0, index + 1));
      loadChildren(crumb.id);
    }
  }

  async function handleSave() {
    if (!id) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await apiFetch(`/api/templates/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grade,
          difficulty,
          subject,
          skill: selectedSkillId,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setSaveError(data.detail ?? "Save failed");
        return;
      }
      navigate(`/templates/${id}`);
    } catch (e: any) {
      setSaveError(e.message ?? "Unexpected error");
    } finally {
      setSaving(false);
    }
  }

  if (!template) {
    return (
      <Layout>
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border text-primary" role="status" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-4" style={{ maxWidth: 700 }}>

        {/* Header */}
        <div className="d-flex align-items-center gap-3 mb-3">
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={() => navigate(`/templates/${id}`)}
          >
            ← Back
          </button>
          <h4 className="mb-0">Edit Metadata</h4>
        </div>

        {/* Question preview */}
        {(() => {
          const q = extractQuestion(template.content ?? "");
          const title = template.name || template.subject || "";
          return (q || title) ? (
            <div className="card mb-4 border-0 bg-light">
              <div className="card-body py-3">
                {title && <div className="text-muted small mb-1">{title}</div>}
                {q && <div className="fw-semibold">{q}</div>}
              </div>
            </div>
          ) : null;
        })()}

        {/* Grade + Difficulty */}
        <div className="row g-3 mb-4">
          <div className="col-sm-4">
            <label className="form-label fw-semibold">Year / Grade</label>
            <select
              className="form-select"
              value={grade}
              onChange={e => setGrade(e.target.value)}
            >
              <option value="">— select —</option>
              {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="col-sm-4">
            <label className="form-label fw-semibold">Difficulty</label>
            <select
              className="form-select"
              value={difficulty}
              onChange={e => setDifficulty(e.target.value)}
            >
              <option value="">— select —</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div className="col-sm-4">
            <label className="form-label fw-semibold">Subject</label>
            {selectedSkillDetail ? (
              <select
                className="form-select"
                value={subject}
                onChange={e => setSubject(e.target.value)}
              >
                <option value="">— select —</option>
                {selectedSkillDetail.split("\n").filter(Boolean).map((line, i) => (
                  <option key={i} value={line}>{line}</option>
                ))}
              </select>
            ) : (
              <input
                className="form-control"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="e.g. Fractions"
              />
            )}
          </div>
        </div>

        {/* Skill browser */}
        <div className="mb-4">
          <label className="form-label fw-semibold">Skill</label>

          {/* Current selection */}
          {selectedSkillId && (
            <div className="alert alert-success py-2 d-flex justify-content-between align-items-center mb-2">
              <span><strong>Selected:</strong> {selectedSkillDesc}</span>
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => { setSelectedSkillId(null); setSelectedSkillDesc(""); setSelectedSkillDetail(null); }}
              >
                Clear
              </button>
            </div>
          )}

          {selectedSkillId && selectedSkillDetail && (
            <div className="mt-2 p-2 bg-light rounded" style={{ fontSize: 13 }}>
              <ul className="mb-0 ps-3">
                {selectedSkillDetail.split("\n").filter(Boolean).map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Breadcrumb */}
          <nav aria-label="skill breadcrumb" className="mb-2">
            <ol className="breadcrumb mb-0">
              <li className="breadcrumb-item">
                <button
                  className="btn btn-link p-0 text-decoration-none"
                  onClick={() => navigateBreadcrumb(-1)}
                >
                  All Skills
                </button>
              </li>
              {breadcrumb.map((crumb, i) => (
                <li key={crumb.id} className="breadcrumb-item">
                  <button
                    className="btn btn-link p-0 text-decoration-none"
                    onClick={() => navigateBreadcrumb(i)}
                  >
                    {crumb.description}
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          {/* Children list */}
          <div className="border rounded" style={{ maxHeight: 320, overflowY: "auto" }}>
            {loadingSkills ? (
              <div className="d-flex justify-content-center py-3">
                <div className="spinner-border spinner-border-sm text-primary" role="status" />
              </div>
            ) : children.length === 0 ? (
              <div className="text-muted p-3">No skills found.</div>
            ) : (
              <div className="list-group list-group-flush">
                {children.map(skill => (
                  <button
                    key={skill.id}
                    className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                    onClick={() => drillDown(skill)}
                  >
                    <span>{skill.description}</span>
                    {skill.children_count > 0 ? (
                      <span className="text-muted small">▶</span>
                    ) : (
                      selectedSkillId === skill.id
                        ? <span className="badge bg-success">Selected</span>
                        : <span className="badge bg-outline text-muted border">Select</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {saveError && <div className="alert alert-danger py-2">{saveError}</div>}

        <button
          className="btn btn-primary w-100"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? <><span className="spinner-border spinner-border-sm me-2" />Saving…</> : "Save Metadata"}
        </button>

        <hr className="my-4" />

        <div className="d-flex justify-content-end">
          <button
            className="btn btn-outline-danger btn-sm"
            onClick={async () => {
              if (!window.confirm("Delete this template? This cannot be undone.")) return;
              setDeleting(true);
              const res = await apiFetch(`/api/templates/${id}/`, { method: "DELETE" });
              if (!res.ok) { alert("Failed to delete template"); setDeleting(false); return; }
              const qs = new URLSearchParams();
              if (selectedSkillId) qs.set("skill", String(selectedSkillId));
              if (grade) qs.set("grade", grade);
              navigate(`/templates/editor?${qs.toString()}`);
            }}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete Template"}
          </button>
        </div>

      </div>
    </Layout>
  );
}

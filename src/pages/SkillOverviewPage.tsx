import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { apiFetch } from "../utils/apiFetch";

interface KnowledgeSummary {
  id: number;
  title: string;
  skill_ids: number[];
}

interface TemplateSummary {
  id: number;
  name: string;
  description: string;
  subject: string | null;
  difficulty: string;
  validated: boolean;
  grade: string;
  question_text: string;
}

const DIFFICULTIES = ["easy", "medium", "hard"] as const;

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

function validationColour(group: TemplateSummary[]): string {
  if (group.length === 0) return "secondary";
  const validatedCount = group.filter(t => t.validated).length;
  if (validatedCount === group.length) return "success";
  if (validatedCount > 0) return "warning";
  return "danger";
}

export function SkillOverviewPage() {
  const { skillId, grade } = useParams<{ skillId: string; grade: string }>();
  const navigate = useNavigate();

  const [skillName, setSkillName] = useState<string>("");
  const [skillDetail, setSkillDetail] = useState<string>("");
  const [skillGrades, setSkillGrades] = useState<string[]>([]);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const [knowledge, setKnowledge] = useState<KnowledgeSummary[]>([]);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [allKnowledge, setAllKnowledge] = useState<KnowledgeSummary[]>([]);
  const [linking, setLinking] = useState(false);
  const [aligning, setAligning] = useState(false);
  const [alignResult, setAlignResult] = useState<{ updated: number; total: number; errors: string[] } | null>(null);
  const [creatingSlot, setCreatingSlot] = useState<string | null>(null); // "grade:diff:subject"
  const [creatingEmptySlot, setCreatingEmptySlot] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    if (!skillId) return;
    apiFetch(`/api/skills/${skillId}/`)
      .then(r => r.json())
      .then(d => {
        setSkillName(d.description ?? "");
        setSkillDetail(d.detail ?? "");
        const raw: string = d.grades ?? "";
        const parsed = raw.split(",").map(g => g.trim()).filter(Boolean);
        setSkillGrades(parsed);
      });
  }, [skillId]);

  useEffect(() => {
    if (!skillId) return;
    setLoading(true);
    apiFetch(`/api/templates/filtered/?skill=${skillId}`)
      .then(r => r.json())
      .then((data: TemplateSummary[]) => {
        setTemplates(data);
        setLoading(false);
      });
  }, [skillId]);

  const fetchKnowledge = () => {
    if (!skillId) return;
    apiFetch(`/api/knowledge/?skill_id=${skillId}`)
      .then(r => r.json())
      .then((data: KnowledgeSummary[]) => setKnowledge(data));
  };

  useEffect(() => {
    fetchKnowledge();
  }, [skillId]);

  const openLinkModal = async () => {
    const res = await apiFetch("/api/knowledge/");
    const all: KnowledgeSummary[] = await res.json();
    const linkedIds = new Set(knowledge.map(k => k.id));
    setAllKnowledge(all.filter(k => !linkedIds.has(k.id)));
    setShowLinkModal(true);
  };

  const linkKnowledge = async (k: KnowledgeSummary) => {
    setLinking(true);
    const updatedSkillIds = [...k.skill_ids, parseInt(skillId!)];
    await apiFetch(`/api/knowledge/${k.id}/`, {
      method: "PATCH",
      body: JSON.stringify({ skill_ids: updatedSkillIds }),
    });
    setLinking(false);
    setShowLinkModal(false);
    fetchKnowledge();
  };

  const invalidateAll = async () => {
    if (!window.confirm(`Set all templates for "${skillName}" to unvalidated?`)) return;
    await apiFetch("/api/templates/invalidate_all/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skill_id: skillId }),
    });
    const tRes = await apiFetch(`/api/templates/filtered/?skill=${skillId}`);
    setTemplates(await tRes.json());
  };

  const alignSubjects = async () => {
    setAligning(true);
    setAlignResult(null);
    try {
      const res = await apiFetch("/api/templates/align_subjects/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill_id: skillId }),
      });
      const data = await res.json();
      setAlignResult(data);
      // Refetch templates so subjects are up to date
      const tRes = await apiFetch(`/api/templates/filtered/?skill=${skillId}`);
      const tData: TemplateSummary[] = await tRes.json();
      setTemplates(tData);
    } catch (err) {
      setAlignResult({ updated: 0, total: 0, errors: [String(err)] });
    } finally {
      setAligning(false);
    }
  };

  const createForSubject = async (g: string, diff: string, subject: string) => {
    const key = `${g}:${diff}:${subject}`;
    setCreatingSlot(key);
    try {
      const res = await apiFetch("/api/templates/generate_for_subject/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill_id: skillId, grade: g, difficulty: diff, subject }),
      });
      const data = await res.json();
      if (data.id) {
        navigate(`/templates/${data.id}`);
      }
    } catch (err) {
      console.error("Failed to create template:", err);
    } finally {
      setCreatingSlot(null);
    }
  };

  const createEmptyForSubject = async (g: string, diff: string, subject: string) => {
    const key = `${g}:${diff}:${subject}`;
    setCreatingEmptySlot(key);
    try {
      const res = await apiFetch("/api/templates/create_empty_for_subject/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill_id: skillId, grade: g, difficulty: diff, subject }),
      });
      const data = await res.json();
      if (data.id) navigate(`/templates/${data.id}`);
    } catch (err) {
      console.error("Failed to create empty template:", err);
    } finally {
      setCreatingEmptySlot(null);
    }
  };

  const deleteTemplate = async (t: TemplateSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${t.subject || t.name}"? This cannot be undone.`)) return;
    setDeletingId(t.id);
    await apiFetch(`/api/templates/${t.id}/`, { method: "DELETE" });
    setTemplates(prev => prev.filter(x => x.id !== t.id));
    setDeletingId(null);
  };

  const unlinkKnowledge = async (k: KnowledgeSummary) => {
    const updatedSkillIds = k.skill_ids.filter(id => id !== parseInt(skillId!));
    await apiFetch(`/api/knowledge/${k.id}/`, {
      method: "PATCH",
      body: JSON.stringify({ skill_ids: updatedSkillIds }),
    });
    fetchKnowledge();
  };

  // Build ordered detail lines for sorting
  const detailLines = skillDetail.split("\n").map(s => s.trim()).filter(Boolean);

  function sortBySubject(group: TemplateSummary[]): TemplateSummary[] {
    return [...group].sort((a, b) => {
      const ai = detailLines.indexOf(a.subject ?? "");
      const bi = detailLines.indexOf(b.subject ?? "");
      const aInDetail = ai !== -1;
      const bInDetail = bi !== -1;
      if (aInDetail && bInDetail) return ai - bi;
      if (aInDetail) return -1;
      if (bInDetail) return 1;
      // Both unaligned — sort alphabetically by subject
      return (a.subject ?? "").localeCompare(b.subject ?? "");
    });
  }

  // Grades from the syllabus
  const syllabus = new Set(skillGrades.map(String));

  // Extra grades: templates exist but grade is NOT in the syllabus
  const extraGrades = Array.from(new Set(templates.map(t => String(t.grade)).filter(g => g && !syllabus.has(g))));

  const syllabusList = skillGrades.length > 0 ? skillGrades.map(String) : grade ? [String(grade)] : [];
  const gradesToShow = [...syllabusList, ...extraGrades.filter(g => !syllabusList.includes(g))];

  return (
    <Layout>
      <div className="container-fluid py-3">

        {/* Header */}
        <div className="d-flex align-items-center gap-3 mb-4 flex-wrap">
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={() => navigate(-1)}
          >
            ← Back
          </button>
          <h4 className="mb-0 flex-grow-1">{skillName}</h4>
          <button
            className="btn btn-outline-success btn-sm"
            onClick={() => navigate(`/knowledge/new?skill_id=${skillId}`)}
          >
            + Create Knowledge
          </button>
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={openLinkModal}
          >
            Link Knowledge
          </button>
          <button
            className="btn btn-outline-primary btn-sm"
            onClick={alignSubjects}
            disabled={aligning}
          >
            {aligning ? "Aligning…" : "Align Subjects with Skill Detail"}
          </button>
          <button
            className="btn btn-outline-danger btn-sm"
            onClick={invalidateAll}
          >
            Invalidate All
          </button>
        </div>


        {skillDetail && (
          <div className="mb-4 p-3 bg-light rounded" style={{ fontSize: 14 }}>
            <ul className="mb-0 ps-3">
              {skillDetail.split("\n").filter(Boolean).map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        {loading ? (
          <div className="d-flex justify-content-center py-5">
            <div className="spinner-border text-primary" role="status" />
          </div>
        ) : (
          <div className="d-flex flex-column gap-4">
            {gradesToShow.map(g => {
              const gradeTemplates = templates.filter(t => String(t.grade) === String(g));
              const isOutOfSyllabus = !syllabus.has(String(g));
              return (
                <div key={g}>
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <h5 className="mb-0">Year {g}</h5>
                    {isOutOfSyllabus && (
                      <span className="badge bg-warning text-dark">
                        Not in syllabus for this year
                      </span>
                    )}
                  </div>
                  <div className="row g-3">
                    {DIFFICULTIES.map(diff => {
                      const group = sortBySubject(gradeTemplates.filter(t => t.difficulty === diff));
                      const colour = validationColour(group);
                      const coveredSubjects = new Set(group.map(t => t.subject).filter(Boolean));
                      const validatedSubjects = new Set(group.filter(t => t.validated).map(t => t.subject).filter(Boolean));
                      const detailTotal = detailLines.length;
                      const detailCovered = detailLines.filter(d => validatedSubjects.has(d)).length;
                      const missingDetails = detailLines.filter(d => !coveredSubjects.has(d));
                      return (
                        <div key={diff} className="col-md-4">
                          <div className="card h-100">
                            <div className={`card-header bg-${colour} bg-opacity-25 d-flex justify-content-between align-items-center`}>
                              <strong>{DIFFICULTY_LABEL[diff]}</strong>
                              <span className={`badge bg-${colour} ${colour === "warning" ? "text-dark" : "text-white"}`}>
                                {detailTotal > 0 ? `${detailCovered} / ${detailTotal}` : `${group.filter(t => t.validated).length} / ${group.length}`}
                              </span>
                            </div>
                            <div className="card-body p-2">
                              <div className="d-flex flex-column gap-1">
                                {group.map(t => (
                                  <div
                                    key={t.id}
                                    className={`btn btn-sm text-start w-100 d-flex align-items-start gap-1 p-0 ${t.validated ? "btn-outline-success" : "btn-outline-secondary"}`}
                                  >
                                    <div
                                      className="flex-grow-1 p-2"
                                      style={{ cursor: "pointer" }}
                                      onClick={() => navigate(`/templates/${t.id}`)}
                                    >
                                      <div className="d-flex justify-content-between align-items-start">
                                        {t.subject
                                          ? <strong className="small">{t.subject}</strong>
                                          : <strong className="small text-danger fst-italic">No subject</strong>
                                        }
                                        {t.validated && (
                                          <span className="badge bg-success ms-2 flex-shrink-0">✓</span>
                                        )}
                                      </div>
                                      {t.question_text && (
                                        <div className="text-muted small mt-1" style={{ whiteSpace: "normal", lineHeight: 1.3 }}>
                                          {t.question_text}
                                        </div>
                                      )}
                                    </div>
                                    <button
                                      className="btn btn-sm btn-link text-danger p-1 flex-shrink-0"
                                      style={{ fontSize: 14, lineHeight: 1 }}
                                      disabled={deletingId === t.id}
                                      onClick={(e) => deleteTemplate(t, e)}
                                      title="Delete template"
                                    >
                                      {deletingId === t.id ? "…" : "✕"}
                                    </button>
                                  </div>
                                ))}
                                {missingDetails.map(subject => {
                                  const key = `${g}:${diff}:${subject}`;
                                  const isCreating = creatingSlot === key;
                                  return (
                                    <div
                                      key={subject}
                                      className="rounded p-2"
                                      style={{ border: "1px solid #f5c6cb", background: "#fff5f5" }}
                                    >
                                      <div className="small text-danger mb-1" style={{ lineHeight: 1.3 }}>{subject}</div>
                                      <div className="d-flex gap-1 flex-wrap">
                                        <button
                                          className="btn btn-sm btn-outline-danger"
                                          onClick={() => navigate(
                                            `/templates/new?skill_id=${skillId}&grade=${encodeURIComponent(String(g))}&difficulty=${encodeURIComponent(diff)}&subject=${encodeURIComponent(subject)}`
                                          )}
                                        >
                                          Create Template - Image
                                        </button>
                                        <button
                                          className="btn btn-sm btn-outline-danger"
                                          disabled={isCreating}
                                          onClick={() => createForSubject(String(g), diff, subject)}
                                        >
                                          {isCreating ? "Creating…" : "Create Template"}
                                        </button>
                                        <button
                                          className="btn btn-sm btn-outline-danger"
                                          disabled={creatingEmptySlot === key}
                                          onClick={() => createEmptyForSubject(String(g), diff, subject)}
                                        >
                                          {creatingEmptySlot === key ? "Creating…" : "Create Empty"}
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                                {group.length === 0 && missingDetails.length === 0 && (
                                  <p className="text-muted small mb-0 p-2">No templates yet</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Knowledge ─────────────────────────────────────── */}
        <div className="mt-4">
          <h5 className="mb-3">Knowledge</h5>
          {knowledge.length === 0 ? (
            <p className="text-muted small">No knowledge linked to this skill yet.</p>
          ) : (
            <div className="d-flex flex-column gap-2">
              {knowledge.map(k => (
                <div key={k.id} className="d-flex align-items-center gap-2 p-2 border rounded bg-white">
                  <span className="flex-grow-1">{k.title}</span>
                  <button
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => navigate(`/knowledge/${k.id}`)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-outline-danger btn-sm"
                    onClick={() => unlinkKnowledge(k)}
                  >
                    Unlink
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Link Knowledge Modal ───────────────────────────── */}
        {showLinkModal && (
          <div className="modal show d-block" style={{ background: "rgba(0,0,0,0.4)" }}>
            <div className="modal-dialog modal-dialog-scrollable">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Link Existing Knowledge</h5>
                  <button className="btn-close" onClick={() => setShowLinkModal(false)} />
                </div>
                <div className="modal-body">
                  {allKnowledge.length === 0 ? (
                    <p className="text-muted">No unlinked knowledge items found.</p>
                  ) : (
                    <div className="d-flex flex-column gap-2">
                      {allKnowledge.map(k => (
                        <button
                          key={k.id}
                          className="btn btn-outline-secondary text-start"
                          disabled={linking}
                          onClick={() => linkKnowledge(k)}
                        >
                          {k.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowLinkModal(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {alignResult && (
        <div
          style={{
            position: "fixed", bottom: 24, right: 24, zIndex: 9999,
            minWidth: 280, maxWidth: 420,
            background: alignResult.errors.length > 0 ? "#fff3cd" : "#d1e7dd",
            border: `1px solid ${alignResult.errors.length > 0 ? "#ffc107" : "#a3cfbb"}`,
            borderRadius: 8, padding: "12px 16px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            fontSize: 13,
          }}
        >
          <div className="d-flex justify-content-between align-items-start gap-2">
            <div>
              <strong>Subjects aligned:</strong> {alignResult.updated} / {alignResult.total} updated.
              {alignResult.errors.length > 0 && (
                <ul className="mb-0 mt-1 ps-3">
                  {alignResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
            <button
              className="btn-close btn-sm flex-shrink-0"
              onClick={() => setAlignResult(null)}
              style={{ fontSize: 10 }}
            />
          </div>
        </div>
      )}
    </Layout>
  );
}

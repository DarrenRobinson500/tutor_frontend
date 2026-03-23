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

  const unlinkKnowledge = async (k: KnowledgeSummary) => {
    const updatedSkillIds = k.skill_ids.filter(id => id !== parseInt(skillId!));
    await apiFetch(`/api/knowledge/${k.id}/`, {
      method: "PATCH",
      body: JSON.stringify({ skill_ids: updatedSkillIds }),
    });
    fetchKnowledge();
  };

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
                      const group = gradeTemplates.filter(t => t.difficulty === diff);
                      const colour = validationColour(group);
                      const validatedCount = group.filter(t => t.validated).length;
                      return (
                        <div key={diff} className="col-md-4">
                          <div className="card h-100">
                            <div className={`card-header bg-${colour} bg-opacity-25 d-flex justify-content-between align-items-center`}>
                              <strong>{DIFFICULTY_LABEL[diff]}</strong>
                              <span className={`badge bg-${colour} ${colour === "warning" ? "text-dark" : "text-white"}`}>
                                {validatedCount} / {group.length}
                              </span>
                            </div>
                            <div className="card-body p-2">
                              {group.length === 0 ? (
                                <p className="text-muted small mb-0 p-2">No templates yet</p>
                              ) : (
                                <div className="d-flex flex-column gap-1">
                                  {group.map(t => (
                                    <button
                                      key={t.id}
                                      className={`btn btn-sm text-start w-100 ${t.validated ? "btn-outline-success" : "btn-outline-secondary"}`}
                                      onClick={() => navigate(`/templates/${t.id}`)}
                                    >
                                      <div className="d-flex justify-content-between align-items-start">
                                        <strong className="small">{t.name || t.question_text || "(untitled)"}</strong>
                                        {t.validated && (
                                          <span className="badge bg-success ms-2 flex-shrink-0">✓</span>
                                        )}
                                      </div>
                                      {t.question_text && (
                                        <div className="text-muted small mt-1" style={{ whiteSpace: "normal", lineHeight: 1.3 }}>
                                          {t.question_text}
                                        </div>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              )}
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
    </Layout>
  );
}

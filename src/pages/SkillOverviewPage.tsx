import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { apiFetch } from "../utils/apiFetch";

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
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!skillId) return;
    apiFetch(`/api/skills/${skillId}/`)
      .then(r => r.json())
      .then(d => setSkillName(d.description ?? ""));
  }, [skillId]);

  useEffect(() => {
    if (!skillId) return;
    setLoading(true);
    const params = new URLSearchParams({ skill: skillId });
    if (grade) params.set("grade", grade);
    apiFetch(`/api/templates/filtered/?${params}`)
      .then(r => r.json())
      .then((data: TemplateSummary[]) => {
        setTemplates(data);
        setLoading(false);
      });
  }, [skillId, grade]);

  const byDifficulty = (diff: string) =>
    templates.filter(t => t.difficulty === diff);

  return (
    <Layout>
      <div className="container-fluid py-3">

        {/* Header */}
        <div className="d-flex align-items-center gap-3 mb-4">
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={() => navigate(-1)}
          >
            ← Back
          </button>
          <div>
            <h4 className="mb-0">{skillName}</h4>
            {grade && (
              <small className="text-muted">Year {grade}</small>
            )}
          </div>
        </div>

        {loading ? (
          <div className="d-flex justify-content-center py-5">
            <div className="spinner-border text-primary" role="status" />
          </div>
        ) : (
          <div className="row g-3">
            {DIFFICULTIES.map(diff => {
              const group = byDifficulty(diff);
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
        )}

      </div>
    </Layout>
  );
}

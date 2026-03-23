import React, { useEffect, useState } from "react";
import { apiFetch } from "../../utils/apiFetch";
import { useTemplateApi } from "../../api/useTemplateApi";
import { useNavigate } from "react-router-dom";
import { usePreferenceStore } from "../../utils/pref";


interface CellData {
  colour: string;
  count: number | null;
  validated: number;
  unvalidated: number;
}


interface SkillRow {
  id: number;
  code: string;
  description: string;
  depth: number;
  parent_id: number | null;
  children_count: number;
  detail?: string;
  cells: Record<string, CellData>;
}

interface MatrixResponse {
  grades: (string | number)[];
  skills: SkillRow[];
}

export function SkillsMatrix() {
  const [data, setData] = useState<MatrixResponse | null>(null);
  const { generateTemplate } = useTemplateApi();
  const navigate = useNavigate();
  const [loadingCell, setLoadingCell] = useState<{ skillId: number; grade: string | number } | null>(null);
  const savedGrade = usePreferenceStore(s => s.get("skills.selected_grade"));
  const [selectedGrade, setSelectedGrade] = useState<string | number | null>(savedGrade ?? null);

  useEffect(() => {
    const grade = selectedGrade ?? "All";
    apiFetch(`/api/skills/matrix/?grade=${grade}`)
      .then(res => res.json())
      .then(data => setData(data));
  }, [selectedGrade]);

  function handleCreateTemplate(skillId: number, grade: string | number) {
    setLoadingCell({ skillId, grade });
    generateTemplate(skillId, grade)
      .then((template) => { navigate(`/templates/${template.id}`); })
      .catch((err) => { console.error("Template generation failed:", err); })
      .finally(() => { setLoadingCell(null); });
  }

  async function handleViewTemplate(skillId: number, grade: string | number) {
    try {
      const res = await apiFetch("/api/templates/preview/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill: skillId, grade }),
      });
      const data = await res.json();
      if (!data.ok) alert(data.error || "Preview failed, opening template for editing.");
      if (data.template_id) { navigate(`/templates/${data.template_id}`); return; }
      alert("No templates exist yet for this skill and grade.");
    } catch (err) {
      console.error("Failed to load first template:", err);
      alert("Unexpected error loading template.");
    }
  }

  if (!data) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: "200px" }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading…</span>
        </div>
      </div>
    );
  }

  const isAllView = selectedGrade === null;

  return (
    <div className="skills-matrix-container">

      {/* Grade Filter Buttons */}
      <div className="mb-3 d-flex gap-2 align-items-center flex-wrap">
        {data.grades.map(g => (
          <button
            key={g}
            className={`btn ${selectedGrade === g ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => {
              setSelectedGrade(g);
              usePreferenceStore.getState().set("skills.selected_grade", g);
            }}
          >
            {g}
          </button>
        ))}
        <button
          className={`btn ${selectedGrade === null ? "btn-secondary" : "btn-outline-secondary"}`}
          onClick={() => {
            setSelectedGrade(null);
            usePreferenceStore.getState().set("skills.selected_grade", null);
          }}
        >
          All
        </button>
      </div>

      {/* ── ALL VIEW: full grade grid ── */}
      {isAllView ? (
        <div style={{ overflowX: "auto", maxHeight: "75vh", overflowY: "auto" }}>
          <table className="skills-matrix" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th className="skill-header" style={{ minWidth: 220, position: "sticky", top: 0, left: 0, zIndex: 3, background: "#fff" }}>Skill</th>
                {data.grades.map(g => (
                  <th key={g} className="skill-header" style={{ textAlign: "center", minWidth: 36, position: "sticky", top: 0, zIndex: 2, background: "#fff" }}>
                    {g}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.skills.map(skill => (
                <tr key={skill.id} className={skill.children_count > 0 ? "parent-row" : ""}>
                  <td style={{ paddingLeft: `${skill.depth * 16 + 8}px`, whiteSpace: "nowrap", position: "sticky", left: 0, zIndex: 1, background: skill.children_count > 0 ? "#f0f0f0" : "#fff" }} title={skill.detail || undefined}>
                    {skill.description}
                  </td>
                  {data.grades.map(g => {
                    const gStr = String(g);
                    const cell = skill.cells[gStr];
                    const covered = cell?.colour === "covered";
                    const count = cell?.count ?? 0;
                    const hasTemplates = count > 0;
                    const anomaly = hasTemplates && !covered; // templates outside syllabus

                    let bg = "transparent";
                    let color = "#999";
                    let cursor = "default";
                    let title = "";

                    if (covered && hasTemplates) {
                      bg = "#c8e6c9";   // green — in syllabus + has templates
                      color = "#1b5e20";
                      cursor = "pointer";
                      title = `${count} template${count !== 1 ? "s" : ""} — click for overview`;
                    } else if (covered) {
                      bg = "#e3f2fd";   // light blue — in syllabus, no templates yet
                      color = "#bbb";
                    } else if (anomaly) {
                      bg = "#fff3cd";   // amber — NOT in syllabus but templates exist
                      color = "#856404";
                      cursor = "pointer";
                      title = `${count} template${count !== 1 ? "s" : ""} (not in syllabus for this year) — click for overview`;
                    }

                    return (
                      <td
                        key={gStr}
                        style={{
                          background: bg,
                          color,
                          textAlign: "center",
                          cursor,
                          fontSize: 11,
                          fontWeight: hasTemplates ? 600 : 400,
                          padding: "2px 4px",
                          border: anomaly ? "1px solid #ffc107" : undefined,
                        }}
                        title={title}
                        onClick={() => {
                          if (hasTemplates) navigate(`/skills/${skill.id}/overview/${gStr}`);
                        }}
                      >
                        {hasTemplates ? count : (covered ? "" : "")}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── SINGLE GRADE VIEW: existing layout ── */
        <table className="skills-matrix">
          <thead>
            <tr>
              <th className="skill-header">Skill</th>
              <th className="skill-header">Templates</th>
              <th className="skill-header">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.skills.map(skill => {
              const gradeStr = String(selectedGrade);
              const cell = skill.cells[gradeStr];
              const isParent = skill.children_count > 0;
              const isLoading =
                loadingCell &&
                loadingCell.skillId === skill.id &&
                loadingCell.grade === selectedGrade;

              return (
                <tr key={skill.id} className={isParent ? "parent-row" : ""}>
                  <td style={{ paddingLeft: `${skill.depth * 20 + 10}px` }} title={skill.detail || undefined}>
                    {skill.description}
                  </td>

                  <td className="matrix-cell">
                    {cell ? (
                      <>
                        {cell.unvalidated > 0 && (
                          <span className="badge bg-warning text-dark me-1">{cell.unvalidated}</span>
                        )}
                        {cell.validated > 0 && (
                          <span className="badge bg-success me-1">{cell.validated}</span>
                        )}
                      </>
                    ) : "-"}
                  </td>

                  <td className="d-flex gap-2 align-items-center">
                    {skill.children_count === 0 && (
                      <div className="d-flex gap-2 mt-1">
                        {isLoading ? (
                          <div className="spinner-border spinner-border-sm text-success" role="status" />
                        ) : (
                          cell?.colour === "covered" && (
                            <button
                              className="btn btn-outline-primary btn-sm"
                              onClick={() => handleCreateTemplate(skill.id, selectedGrade!)}
                            >
                              Create Templates
                            </button>
                          )
                        )}
                        {!isLoading && (cell?.count ?? 0) > 0 && (
                          <button
                            className="btn btn-outline-primary btn-sm"
                            onClick={() => handleViewTemplate(skill.id, selectedGrade!)}
                          >
                            View Templates
                          </button>
                        )}
                        {!isLoading && (cell?.count ?? 0) > 0 && (
                          <button
                            className="btn btn-outline-secondary btn-sm"
                            onClick={() => navigate(`/skills/${skill.id}/overview/${gradeStr}`)}
                          >
                            Overview
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

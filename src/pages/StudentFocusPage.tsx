import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { apiFetch } from "../utils/apiFetch";

interface FocusArea {
  id: number;
  skill_id: number;
  skill_code: string;
  skill_description: string;
  mastery: number;
  competence_label: string;
}

interface SkillRow {
  id: number;
  code: string;
  description: string;
  depth: number;
  children_count: number;
  parent_id: number | null;
}

interface MasteryEntry {
  mastery: number;
  competence_label: string;
}

const COMPETENCE_BADGE: Record<string, string> = {
  Developing: "secondary",
  Emerging: "warning",
  Competent: "primary",
  Mastered: "success",
};

export function StudentFocusPage() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const returnTo = params.get("returnTo") || `/tutors`;

  const [student, setStudent] = useState<any>(null);
  const [focusAreas, setFocusAreas] = useState<FocusArea[]>([]);
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [masteryMap, setMasteryMap] = useState<Record<number, MasteryEntry>>({});
  const [focusIds, setFocusIds] = useState<Set<number>>(new Set());

  // Load student info
  useEffect(() => {
    apiFetch(`/api/students/${studentId}/`)
      .then(r => r.json())
      .then(setStudent);
  }, [studentId]);

  // Load focus areas
  useEffect(() => {
    loadFocusAreas();
  }, [studentId]);

  // Load skills for student's year once we have the grade
  useEffect(() => {
    if (!student?.year_level) return;
    apiFetch(`/api/skills/matrix/?grade=${student.year_level}&student_id=${studentId}`)
      .then(r => r.json())
      .then(data => {
        setSkills((data.skills as SkillRow[]).filter(s => s.children_count === 0));
        setMasteryMap(data.mastery || {});
      });
  }, [student?.year_level, studentId]);

  function loadFocusAreas() {
    apiFetch(`/api/focus-areas/?student_id=${studentId}`)
      .then(r => r.json())
      .then((data: FocusArea[]) => {
        setFocusAreas(data);
        setFocusIds(new Set(data.map(fa => fa.skill_id)));
      });
  }

  async function addFocus(skillId: number) {
    await apiFetch("/api/focus-areas/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId, skill_id: skillId }),
    });
    loadFocusAreas();
  }

  async function removeFocus(focusAreaId: number) {
    await apiFetch(`/api/focus-areas/${focusAreaId}/`, { method: "DELETE" });
    loadFocusAreas();
  }

  if (!student) return <Layout><div className="container mt-4">Loading…</div></Layout>;

  const firstName = student.first_name || student.name?.split(" ")[0] || "Student";

  return (
    <Layout>
      <div className="container mt-4">
        <button className="btn btn-link ps-0 mb-3" onClick={() => navigate(returnTo)}>
          ← Back
        </button>

        <h2>Focus areas for {firstName}</h2>
        {student.year_level && (
          <p className="text-muted">Year {student.year_level}</p>
        )}

        {/* ── Current focus areas ── */}
        <h4 className="mt-4">Current focus areas</h4>
        {focusAreas.length === 0 ? (
          <p className="text-muted">No focus areas set yet.</p>
        ) : (
          <ul className="list-group mb-4">
            {focusAreas.map(fa => (
              <li key={fa.id} className="list-group-item d-flex justify-content-between align-items-center">
                <div>
                  <span className="fw-semibold">{fa.skill_description}</span>
                  <span
                    className={`badge bg-${COMPETENCE_BADGE[fa.competence_label] ?? "secondary"} ms-2`}
                  >
                    {fa.competence_label}
                  </span>
                </div>
                <button
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => removeFocus(fa.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* ── Skills for year ── */}
        <h4 className="mt-4">
          {student.year_level ? `Year ${student.year_level} skills` : "Skills"}
        </h4>
        {!student.year_level && (
          <p className="text-warning">Set the student's year level to see skills.</p>
        )}

        {skills.length > 0 && (
          <ul className="list-group">
            {skills.map(skill => {
              const entry = masteryMap[skill.id];
              const label = entry?.competence_label ?? "Developing";
              const isFocus = focusIds.has(skill.id);
              const focusAreaId = focusAreas.find(fa => fa.skill_id === skill.id)?.id;

              return (
                <li
                  key={skill.id}
                  className={`list-group-item d-flex justify-content-between align-items-center ${isFocus ? "list-group-item-light" : ""}`}
                >
                  <div>
                    <span>{skill.description}</span>
                    <span
                      className={`badge bg-${COMPETENCE_BADGE[label] ?? "secondary"} ms-2`}
                    >
                      {label}
                    </span>
                    {isFocus && (
                      <span className="badge bg-info ms-2">Focus</span>
                    )}
                  </div>
                  {isFocus ? (
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => focusAreaId && removeFocus(focusAreaId)}
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => addFocus(skill.id)}
                    >
                      Add focus area
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Layout>
  );
}

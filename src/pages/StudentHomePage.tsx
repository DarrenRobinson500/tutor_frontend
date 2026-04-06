import { useParams, useNavigate, Link } from "react-router-dom";
import React, { useState, useEffect } from "react";
// import { WeeklyCalendar } from "./components/WeeklyCalendar";
import { Layout } from "./components/Layout";
// import { WeekData } from "../types/weekly";
import { apiFetch } from "../utils/apiFetch";
import { ProgressChart } from "./components/ProgressChart";

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
  cells: Record<string, CellData>;
}

interface FocusArea {
  id: number;
  skill_code: string;
  skill_description: string;
  order: number;
  mastery: number;
  learning_done_this_week: boolean;
  tutoring_done_this_week: boolean;
  level_before_learning: number | null;
  level_after_learning: number | null;
  label_before_learning: string | null;
  label_after_learning: string | null;
}

/** Renders the 0–6 star display for a skill competency level. */
function SkillStars({ level }: { level: number }) {
  // Levels 0–4: up to 4 standard stars (filled + empty)
  // Levels 5–6: 4 standard filled + 1 or 2 bonus stars
  const standard = Math.min(level, 4);
  const bonus    = Math.max(0, level - 4);  // 0, 1 or 2
  const empty    = 4 - standard;

  return (
    <span className="skill-stars" aria-label={`${level} stars`}>
      {Array.from({ length: standard }).map((_, i) => (
        <span key={`s${i}`} className="star star-filled">★</span>
      ))}
      {Array.from({ length: empty }).map((_, i) => (
        <span key={`e${i}`} className="star star-empty">★</span>
      ))}
      {Array.from({ length: bonus }).map((_, i) => (
        <span key={`b${i}`} className="star star-bonus">✦</span>
      ))}
    </span>
  );
}

function FocusAreaCard({ fa, studentId }: { fa: FocusArea; studentId: string }) {
  const gained = (fa.level_after_learning ?? 0) - (fa.level_before_learning ?? 0);
  const improved = fa.learning_done_this_week && gained > 0;
  const stars = fa.learning_done_this_week
    ? (fa.level_after_learning ?? fa.mastery)
    : fa.mastery;

  if (!fa.learning_done_this_week) {
    const params = new URLSearchParams({
      mode: "learning",
      skill_codes: fa.skill_code,
      focus_area_id: String(fa.id),
    });
    return (
      <div className="fa-card">
        <div className="fa-card-name">{fa.skill_description}</div>
        <div className="fa-card-right">
          <SkillStars level={stars} />
          <Link
            to={`/students/${studentId}/test?${params.toString()}`}
            className="btn btn-success btn-sm"
          >
            Learn
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fa-card fa-card-done">
      <div className="fa-card-name">{fa.skill_description}</div>
      <div className="fa-card-right">
        <SkillStars level={stars} />
        <div className="fa-card-status">
          <span className="fa-done-label">Learning completed</span>
          {improved && (
            <span className="fa-improved-label">
              +{gained} star{gained > 1 ? "s" : ""} this week
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function StudentHomePage() {
  const { id } = useParams();
  const [student, setStudent] = useState<any>(null);
  const navigate = useNavigate();
  const [syllabus, setSyllabus] = useState<SkillRow[]>([]);
  const [mastery, setMastery] = useState<any>({});
  const [focusAreas, setFocusAreas] = useState<FocusArea[]>([]);

  useEffect(() => {
    apiFetch(`/api/students/${id}/home/`)
      .then((res) => res.json())
      .then((data) => setStudent(data));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    apiFetch(`/api/focus-areas/?student_id=${id}`)
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setFocusAreas(data); });
  }, [id]);

//   const tutorId = student?.tutor_id;

  useEffect(() => {
    if (!student?.year_level) return;

    apiFetch(`/api/skills/matrix/?grade=${student.year_level}&student_id=${id}`)
      .then(res => res.json())
      .then(data => {
        setSyllabus(data.skills);
        setMastery(data.mastery);
      });
  }, [student]);

  if (!student) {
    return (
      <Layout>
        <div className="container mt-4">Loading…</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mt-4">
        <h1>Welcome back {student.name?.split(" ")[0]}</h1>
        <p><strong>Email:</strong> {student.email}<br/>
        <strong>Year Level:</strong> {student.year_level || "Not set"}<br/>
        <strong>Area of Study:</strong> {student.area_of_study || "Not set"}
        </p>
        <button
          className="btn btn-outline-primary"
          onClick={() => navigate(`/students/${id}/edit?returnTo=/students/${id}`)}
        >
          Edit My Details
        </button>
        <div className="d-flex flex-wrap gap-2 mt-2">
          <Link to={`/students/${id}/test?type=dynamic`} className="btn btn-outline-success">
            Start Skills Test
          </Link>
        </div>

        {focusAreas.length > 0 && (
          <>
            <hr />
            <h3 className="mt-4">Your Focus Areas</h3>
            <div className="fa-card-list">
              {focusAreas.map(fa => (
                <FocusAreaCard key={fa.id} fa={fa} studentId={id!} />
              ))}
            </div>
          </>
        )}

        <hr />
        <h3 className="mt-4">Your Progress</h3>
        <ProgressChart studentId={id!} />

        <hr />
        <h3 className="mt-4">Your Syllabus</h3>

        {syllabus.length === 0 && (
          <p>No syllabus available for this year level.</p>
        )}

      <table className="skills-matrix">
        <thead>
          <tr>
            <th className="skill-header">Skill</th>
            <th className="skill-header">Stars</th>
            <th className="skill-header">Actions</th>
          </tr>
        </thead>

        <tbody>
          {syllabus.map(skill => {
            const isParent = skill.children_count > 0;
            const gradeStr = student.year_level ? String(student.year_level) : null;
            const cell = gradeStr ? skill.cells[gradeStr] : null;
            const templateCount = gradeStr && cell ? cell.validated : null;



            return (
              <tr key={skill.id} className={isParent ? "parent-row" : ""}>

                <td style={{ paddingLeft: `${skill.depth * 20 + 10}px` }}>
                  {skill.description}
                </td>

                <td>
                  <SkillStars level={mastery[skill.id]?.mastery ?? 0} />
                </td>

                <td>
                  {templateCount !== null && templateCount > 0 && (
                    <button
                      className="btn btn-sm btn-outline-primary"
                      onClick={() =>
                        navigate(`/students/${id}/test/${skill.id}`)
                      }
                    >
                      Learn
                    </button>
                  )}
                </td>


              </tr>
            );
          })}
        </tbody>
      </table>




      </div>
    </Layout>
  );
}
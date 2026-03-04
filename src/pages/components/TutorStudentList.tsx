import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../utils/apiFetch";

export interface Student {
  user_id: number;
  profile_id: number;
  first_name: string;
  last_name: string;
  email: string;
  active: boolean;
  year_level: string | null;
  area_of_study: string | null;
}

export function TutorStudentList({ tutorId }: { tutorId: string }) {
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    apiFetch(`/api/tutors/${tutorId}/students/`)
      .then(res => res.json())
      .then(data => setStudents(data));
  }, [tutorId]);

  const toggleActive = async (student: Student) => {
    const newActive = !student.active;

    await apiFetch(`/api/students/${student.user_id}/edit/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: { active: newActive },
      }),
    });

    // Update local UI immediately
    setStudents(prev =>
      prev.map(s =>
        s.user_id === student.user_id ? { ...s, active: newActive } : s
      )
    );
  };

  return (
    <ul className="list-group mt-3">
      <li className="list-group-item">
        <div className="row fw-bold">
          <div className="col-2">Name</div>
          <div className="col-2">Year</div>
          <div className="col-2">Area</div>
          <div className="col-3">Email</div>
          <div className="col-3">Actions</div>
        </div>
      </li>

      {students
        .slice()
        .sort((a, b) => {
          if (a.active !== b.active) return a.active ? -1 : 1;
          const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
          const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
          return nameA.localeCompare(nameB);
        })
        .map((s) => (
          <li
            key={s.user_id}
            className={`list-group-item ${!s.active ? "bg-light text-muted" : ""}`}
          >
            <div className="row align-items-center">
              <div className="col-2 fw-bold">
                {s.first_name} {s.last_name}
                {!s.active && (
                  <span className="badge bg-secondary ms-2">inactive</span>
                )}
                {s.active && (
                  <span className="badge bg-success ms-2">active</span>
                )}
              </div>

              <div className="col-2">{s.year_level || "No year"}</div>
              <div className="col-2">{s.area_of_study || "No area"}</div>
              <div className="col-3">{s.email}</div>

              <div className="col-3 d-flex flex-row gap-2">
                <Link
                  className={`btn btn-sm ${
                    s.active ? "btn-outline-primary" : "btn-outline-secondary disabled"
                  }`}
                  to={`/student/${s.user_id}`}
                  style={{
                    minWidth: "160px",
                    whiteSpace: "nowrap",
                    textAlign: "center",
                  }}
                >
                  {s.first_name}'s Home Page
                </Link>

                <Link
                  className="btn btn-sm btn-outline-secondary"
                  to={`/students/${s.user_id}/edit?returnTo=/tutors/${tutorId}` }
                  style={{
                    minWidth: "40px",
                    whiteSpace: "nowrap",
                    textAlign: "center",
                  }}
                >
                  Edit
                </Link>

              </div>
            </div>
          </li>
        ))}
    </ul>
  );
}
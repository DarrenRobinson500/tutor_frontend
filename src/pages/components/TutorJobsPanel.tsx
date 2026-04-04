import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../utils/apiFetch";
import type { Student } from "./TutorStudentList";

interface DerivedJob {
  kind: "derived";
  label: string;
  to: string;
}

interface StoredJob {
  kind: "stored";
  id: number;
  label: string;
  to: string;
}

type Job = DerivedJob | StoredJob;

const JOB_LABELS: Record<string, (firstName: string) => string> = {
  send_progress_message: (n) => `Send progress message for ${n}`,
  review_focus_area: (n) => `Review focus area for ${n}`,
};

const JOB_LINKS: Record<string, (tutorId: string, studentId: number) => string> = {
  send_progress_message: (tutorId) => `/tutors/${tutorId}/sms`,
  review_focus_area: (tutorId, studentId) =>
    `/students/${studentId}/focus-areas?returnTo=/tutors/${tutorId}`,
};

export function TutorJobsPanel({ tutorId }: { tutorId: string }) {
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    load();
  }, [tutorId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    const [students, storedRaw]: [Student[], any[]] = await Promise.all([
      apiFetch(`/api/tutors/${tutorId}/students/`).then(r => r.json()),
      apiFetch(`/api/jobs/`).then(r => r.json()),
    ]);

    const derived: DerivedJob[] = [];

    students.forEach(s => {
      if (!s.year_level) {
        derived.push({
          kind: "derived",
          label: `Add ${s.first_name}'s grade`,
          to: `/students/${s.user_id}/edit?returnTo=/tutors/${tutorId}`,
        });
      }
    });

    const focusRes = await Promise.all(
      students
        .filter(s => s.year_level)
        .map(s =>
          apiFetch(`/api/focus-areas/?student_id=${s.user_id}`)
            .then(r => r.json())
            .then((areas: any[]) => ({ student: s, hasFocus: areas.length > 0 }))
        )
    );

    focusRes.forEach(({ student: s, hasFocus }) => {
      if (!hasFocus) {
        derived.push({
          kind: "derived",
          label: `Set focus area for ${s.first_name}`,
          to: `/students/${s.user_id}/focus-areas?returnTo=/tutors/${tutorId}`,
        });
      }
    });

    const stored: StoredJob[] = storedRaw.map((j: any) => ({
      kind: "stored",
      id: j.id,
      label: (JOB_LABELS[j.job_type] ?? ((n: string) => j.job_type))(j.student_first_name),
      to: (JOB_LINKS[j.job_type] ?? (() => `/tutors/${tutorId}`))(String(j.tutor_id), j.student_id),
    }));

    setJobs([...derived, ...stored]);
  }

  async function complete(id: number) {
    await apiFetch(`/api/jobs/${id}/complete/`, { method: "POST" });
    setJobs(prev => prev.filter(j => !(j.kind === "stored" && j.id === id)));
  }

  if (jobs.length === 0) return null;

  return (
    <div className="mb-4">
      <h4>Jobs</h4>
      <div className="row row-cols-4 gx-4 gy-2">
        {jobs.map((job, i) => (
          <div key={i} className="col">
            {job.kind === "stored" ? (
              <div
                className="px-3 py-2 rounded"
                style={{ background: "#fff3cd", border: "1px solid #ffc107" }}
              >
                <Link to={job.to} className="text-decoration-none fw-semibold d-block mb-1">
                  {job.label}
                </Link>
                <button
                  className="btn btn-sm btn-outline-secondary py-0 px-2"
                  style={{ fontSize: 11 }}
                  onClick={() => complete(job.id)}
                >
                  Done
                </button>
              </div>
            ) : (
              <Link to={job.to} className="text-decoration-none d-block">
                <div
                  className="px-3 py-2 rounded fw-semibold"
                  style={{ background: "#fff3cd", border: "1px solid #ffc107" }}
                >
                  {job.label}
                </div>
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

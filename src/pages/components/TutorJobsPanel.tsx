import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../utils/apiFetch";
import type { Student } from "./TutorStudentList";

interface Job {
  label: string;
  to: string;
}

export function TutorJobsPanel({ tutorId }: { tutorId: string }) {
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    apiFetch(`/api/tutors/${tutorId}/students/`)
      .then(res => res.json())
      .then((students: Student[]) => {
        const derived: Job[] = [];

        students.forEach(s => {
          if (!s.year_level) {
            derived.push({
              label: `Add ${s.first_name}'s grade`,
              to: `/students/${s.user_id}/edit?returnTo=/tutors/${tutorId}`,
            });
          }
        });

        setJobs(derived);
      });
  }, [tutorId]);

  if (jobs.length === 0) return null;

  return (
    <div className="mb-4">
      <h4>Jobs</h4>
      <div className="row row-cols-4 gx-4 gy-2">
        {jobs.map((job, i) => (
          <div key={i} className="col">
            <Link to={job.to} className="text-decoration-none d-block">
              <div
                className="px-3 py-2 rounded fw-semibold"
                style={{ background: "#fff3cd", border: "1px solid #ffc107" }}
              >
                {job.label}
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

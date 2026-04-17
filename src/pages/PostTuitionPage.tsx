import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Layout } from "./components/Layout";
import { apiFetch } from "../utils/apiFetch";

export function PostTuitionPage() {
  const { id: tutorId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const studentId = searchParams.get("student_id");
  const jobId = searchParams.get("job_id");

  const [studentName, setStudentName] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (!studentId) return;
    apiFetch(`/api/students/${studentId}/`)
      .then((r) => r.json())
      .then((d) => setStudentName(d.first_name ? `${d.first_name} ${d.last_name ?? ""}`.trim() : null))
      .catch(() => {});
  }, [studentId]);

  async function handleComplete() {
    if (!jobId) return;
    setCompleting(true);
    try {
      await apiFetch(`/api/jobs/${jobId}/complete/`, { method: "POST" });
      navigate(`/tutors/${tutorId}/`);
    } finally {
      setCompleting(false);
    }
  }

  return (
    <Layout>
      <div className="container py-4" style={{ maxWidth: 780 }}>
        <h2 className="mb-1">Post Tuition</h2>
        <p className="text-muted mb-4">
          {studentName
            ? `Complete the following steps after the session with ${studentName}.`
            : "Complete the following steps after each tutoring session."}
        </p>

        {/* ── Step 1: Parent update message ── */}
        <div className="card mb-4">
          <div className="card-header d-flex align-items-center gap-2">
            <span className="badge bg-primary">1</span>
            <span className="fw-semibold">Send Progress Message</span>
          </div>
          <div className="card-body">
            <p className="text-muted mb-0">
              Review and approve the session summary message to be sent to the parent.
            </p>
            <div className="mt-3 p-3 bg-light rounded text-muted" style={{ fontSize: 14 }}>
              — Placeholder: message preview and approve / edit controls will appear here —
            </div>
          </div>
        </div>

        {/* ── Step 2: Payment ── */}
        <div className="card mb-4">
          <div className="card-header d-flex align-items-center gap-2">
            <span className="badge bg-primary">2</span>
            <span className="fw-semibold">Approve Payment Transfer</span>
          </div>
          <div className="card-body">
            <p className="text-muted mb-0">
              Review the payment breakdown and approve the transfer of funds to all parties.
            </p>
            <div className="mt-3 p-3 bg-light rounded text-muted" style={{ fontSize: 14 }}>
              — Placeholder: payment summary (amount paid, platform / distributor / tutor splits) and approve button will appear here —
            </div>
          </div>
        </div>

        {/* ── Step 3: Focus areas ── */}
        <div className="card mb-4">
          <div className="card-header d-flex align-items-center gap-2">
            <span className="badge bg-primary">3</span>
            <span className="fw-semibold">Update Student Focus Areas</span>
          </div>
          <div className="card-body">
            <p className="text-muted mb-0">
              Review and update the student's focus areas based on what was covered in the session.
            </p>
            <div className="mt-3 p-3 bg-light rounded text-muted" style={{ fontSize: 14 }}>
              — Placeholder: focus area list with add / remove / reorder controls will appear here —
            </div>
          </div>
        </div>

        {/* ── Complete button ── */}
        {jobId && (
          <div className="d-flex justify-content-end">
            <button
              className="btn btn-success px-4"
              onClick={handleComplete}
              disabled={completing}
            >
              {completing ? "Saving…" : "Mark as Complete"}
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}

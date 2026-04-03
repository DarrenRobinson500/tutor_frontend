import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Layout } from "./components/Layout";
import { useTemplateApi } from "../api/useTemplateApi";
import { apiFetch } from "../utils/apiFetch";
import type { TemplateSummary } from "../types/TemplateMetadata";


export function TemplateListPage() {
  const navigate = useNavigate();
  const { listTemplates, deleteTemplate, loading, error } = useTemplateApi();

  const storedUser = localStorage.getItem("user");
  const user = storedUser ? JSON.parse(storedUser) : null;
  const canEditSyllabus = user?.role === "admin" || user?.edit_syllabus === true;

  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [hasNotesOnly, setHasNotesOnly] = useState(() => localStorage.getItem("templateList_hasNotesOnly") === "true");
  const [noSubjectOnly, setNoSubjectOnly] = useState(() => localStorage.getItem("templateList_noSubjectOnly") === "true");
  const [importing, setImporting] = useState(false);
  const [transferMessage, setTransferMessage] = useState("");
  const uploadRef = useRef<HTMLInputElement>(null);

  const handleDownload = () => {
    const d = new Date();
    const date = `${d.getFullYear()}_${String(d.getMonth()+1).padStart(2,"0")}_${String(d.getDate()).padStart(2,"0")}`;
    apiFetch("/api/templates/export_all/")
      .then(res => res.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `templates_${date}.json`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => setTransferMessage("Download failed"));
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImporting(true);
    const form = new FormData();
    form.append("file", file);
    apiFetch("/api/templates/import_bulk/", { method: "POST", body: form })
      .then(res => res.json())
      .then(async data => {
        if (data.error) {
          setTransferMessage(`Upload failed: ${data.error}`);
        } else {
          let msg = `Import complete — created: ${data.created}, skipped (duplicates): ${data.skipped}, errors: ${data.errors}`;
          if (data.first_error) msg += ` — first error: ${data.first_error}`;
          setTransferMessage(msg);
          const refreshed = await listTemplates(hasNotesOnly, noSubjectOnly);
          setTemplates(refreshed);
        }
      })
      .catch(() => setTransferMessage("Upload failed"))
      .finally(() => setImporting(false));
  };

  useEffect(() => {
    async function load() {
      const data = await listTemplates(hasNotesOnly, noSubjectOnly);
      setTemplates(data);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasNotesOnly, noSubjectOnly]);


  async function handleDelete(e: React.MouseEvent, id: number) {
    e.stopPropagation(); // prevent row click navigation

    if (!window.confirm("Delete this template?")) return;

    await deleteTemplate(id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <Layout>
    <div>
      <div className="container mt-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h1 className="h3">Templates</h1>

          <div className="d-flex gap-2 flex-wrap">
            <button
              className={`btn ${hasNotesOnly ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setHasNotesOnly(v => { const next = !v; localStorage.setItem("templateList_hasNotesOnly", String(next)); return next; })}
            >
              {hasNotesOnly ? "Showing: Has Notes" : "Has Notes"}
            </button>
            <button
              className={`btn ${noSubjectOnly ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setNoSubjectOnly(v => { const next = !v; localStorage.setItem("templateList_noSubjectOnly", String(next)); return next; })}
            >
              {noSubjectOnly ? "Showing: No Subject" : "No Subject"}
            </button>
            <button
              className="btn btn-outline-primary"
              onClick={() => navigate("/templates/new")}
            >
              Create New Template
            </button>
            {canEditSyllabus && <>
              <button className="btn btn-outline-secondary" onClick={handleDownload}>
                Download All Templates
              </button>
              <button
                className="btn btn-outline-secondary"
                onClick={() => uploadRef.current?.click()}
                disabled={importing}
              >
                {importing ? "Uploading…" : "Upload All Templates"}
              </button>
              <input ref={uploadRef} type="file" accept=".json" className="d-none" onChange={handleUpload} />
              {process.env.REACT_APP_SHOW_DELETE_ALL === "true" && <button
                className="btn btn-outline-danger"
                onClick={async () => {
                  if (!window.confirm(`Delete all ${templates.length} templates? This cannot be undone.`)) return;
                  const res = await apiFetch("/api/templates/delete_all/", { method: "POST" });
                  const data = await res.json();
                  if (data.error) {
                    setTransferMessage(`Delete failed: ${data.error}`);
                  } else {
                    setTemplates([]);
                    setTransferMessage(`Deleted ${data.deleted} templates.`);
                  }
                }}
              >
                Delete All Templates
              </button>}
            </>}
          </div>
        </div>

        {transferMessage && <div className="alert alert-info py-2 mt-2">{transferMessage}</div>}

        {loading && <p>Loading templates…</p>}
        {error && <p className="text-danger">{error}</p>}

        {!loading && templates.length === 0 && (
          <p>No templates found.</p>
        )}

        {templates.length > 0 && (
          <table className="table table-hover">
            <thead className="table-light">
              <tr>
                <th>Grade</th>
                <th>Skill</th>
                <th>Difficulty</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Updated</th>
                <th>Notes</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>

            <tbody>
              {templates.map((tpl) => (
                <tr
                  key={tpl.id}
                  onClick={() => navigate(`/templates/${tpl.id}`)}
                  style={{ cursor: "pointer" }}
                >
                  <td>{tpl.grade}</td>
                  <td>{tpl.skill}</td>
                  <td>{tpl.difficulty}</td>
                  <td>{tpl.subject}</td>
                  <td>{tpl.status}</td>
                  <td>{new Date(tpl.updated_at).toLocaleString()}</td>
                  <td style={{ maxWidth: 260 }}>
                    {tpl.notes?.map((n, i) => (
                      <div key={i} className="text-muted" style={{ fontSize: 12, lineHeight: 1.4 }}>
                        {n}
                      </div>
                    ))}
                  </td>

                  <td>
                    <button
                      className="btn btn-outline-danger btn-sm"
                      onClick={(e) => handleDelete(e, tpl.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>


</Layout>

  );
}

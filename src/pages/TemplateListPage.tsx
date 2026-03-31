import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Layout } from "./components/Layout";
import { useTemplateApi } from "../api/useTemplateApi";
import type { TemplateSummary } from "../types/TemplateMetadata";


export function TemplateListPage() {
  const navigate = useNavigate();
  const { listTemplates, deleteTemplate, loading, error } = useTemplateApi();

  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [hasNotesOnly, setHasNotesOnly] = useState(() => localStorage.getItem("templateList_hasNotesOnly") === "true");
  const [noSubjectOnly, setNoSubjectOnly] = useState(() => localStorage.getItem("templateList_noSubjectOnly") === "true");

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

          <div className="d-flex gap-2">
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
          </div>
        </div>

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

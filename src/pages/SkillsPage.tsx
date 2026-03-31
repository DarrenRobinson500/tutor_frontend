import React, { useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Breadcrumbs } from "./components/Breadcrumbs";
import { SkillsMatrix } from "./components/SkillsMatrix";
import { Layout } from "./components/Layout";
import { apiFetch } from "../utils/apiFetch";
import { useSkillsApi, Skill } from "../api/useSkillsApi";


export default function SkillsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [skill, setSkill] = useState<any>(null);
  const [parents, setParents] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const { listSkills, loadSyllabus, loading, error } = useSkillsApi();
  const [message, setMessage] = useState("");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [importing, setImporting] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  // Load skill + parents
  useEffect(() => {
    if (!id) {
      setSkill(null);
      setParents([]);
      return;
    }

    const skillId = Number(id);

    apiFetch(`/api/skills/${skillId}/`)
      .then(res => res.json())
      .then(data => setSkill(data));

    apiFetch(`/api/skills/${skillId}/parents/`)
      .then(res => res.json())
      .then(data => setParents(data));
  }, [id]);

  // Load direct templates
  useEffect(() => {
    if (!id) {
      setTemplates([]);
      return;
    }

    apiFetch(`/api/skills/${id}/direct_templates/`)
      .then(res => res.json())
      .then(data => setTemplates(data));
  }, [id]);

  if (id && !skill) {
    return <Layout><div className="container mt-4">Loading...</div></Layout>;
  }

  const handleDownload = () => {
    apiFetch("/api/templates/export_all/")
      .then(res => res.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "templates.json";
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => setMessage("Download failed"));
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
      .then(data => {
        if (data.error) {
          setMessage(`Upload failed: ${data.error}`);
        } else {
          setMessage(`Import complete — created: ${data.created}, skipped (duplicates): ${data.skipped}, errors: ${data.errors}`);
        }
      })
      .catch(() => setMessage("Upload failed"))
      .finally(() => setImporting(false));
  };

  const handleLoad = () => {
    loadSyllabus()
      .then(() => {
        setMessage("Syllabus loaded successfully");
        return listSkills(null);
      })
      .then(setSkills)
      .catch((err) => {
        setMessage(err.error || "Failed to load syllabus");
      });
  };

  return (
    <Layout>
      <div className="container mt-4">


      {message && <div className="alert alert-info">{message}</div>}

        <h1>Skills</h1>
        <div className="d-flex gap-2 mb-3">
          <button
            className="btn btn-outline-success"
            onClick={handleLoad}
            disabled={loading}
          >
            {loading ? "Loading…" : "Load Syllabus"}
          </button>
          <button
            className="btn btn-outline-success"
            onClick={() => navigate("/templates/new")}
          >
            + Create New Template from Image
          </button>
          <button
            className="btn btn-outline-secondary"
            onClick={handleDownload}
          >
            Download all templates
          </button>
          <button
            className="btn btn-outline-secondary"
            onClick={() => uploadRef.current?.click()}
            disabled={importing}
          >
            {importing ? "Uploading…" : "Upload all templates"}
          </button>
          <input
            ref={uploadRef}
            type="file"
            accept=".json"
            className="d-none"
            onChange={handleUpload}
          />
        </div>


        <SkillsMatrix />
      </div>
    </Layout>
  );
}
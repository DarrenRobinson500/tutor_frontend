import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { TemplateMetadata } from "../../types/TemplateMetadata";

interface TemplateMetadataBarProps {
  metadata: TemplateMetadata;
  onChange: (updated: Partial<TemplateMetadata>) => void;
  onSave: () => void;
  onDelete: () => void;
  onCopy: () => void;
  isSaving: boolean;
  saveSuccess: boolean;
  saveError: string | null;
  onValidate: () => void;
  onPreview: () => void;
  onToSkill: () => void;
  onNext: () => void;
  onPrev: () => void;
  skills: Array<{ id: number; description: string }>;
  subjects: string[];
  validated_filter?: "all" | "validated" | "unvalidated";
  onSubjectChange: (subject: string) => void;
}



export function TemplateMetadataBar({
  metadata,
  onChange,
  onSave,
  onDelete,
  onCopy,
  onValidate,
  onPreview,
  onToSkill,
  isSaving,
  saveError,
  saveSuccess,
  onNext,
  onPrev,
  skills,
  subjects,
  onSubjectChange,
}: TemplateMetadataBarProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!metadata) {
    return <div style={{ padding: 12 }}>Loading…</div>;
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: 12 }}>

      {/* Grade */}
      Grade:
      <select
        className="form-select"
        style={{ width: "90px" }}
        value={metadata.grade ?? ""}
        onChange={(e) => onChange({ grade: e.target.value })}
      >
        <option value="">Select grade</option>
        {["K","1","2","3","4","5","6","7","8","9","10"].map(g => (
          <option key={g} value={g}>{g}</option>
        ))}
      </select>

      {/* Skill dropdown */}
      <select
        className="form-select"
        value={metadata.skill ?? ""}
        onChange={(e) => onChange({ skill: Number(e.target.value) })}
      >
        <option value="">Select skill</option>
        {skills.map((s) => (
          <option key={s.id} value={s.id}>
            {s.description}
          </option>
        ))}
      </select>

      {/* Validated filter */}
      <select
        className="form-select"
        style={{ width: "150px" }}
        value={metadata.validated_filter ?? "all"}
        onChange={(e) =>
          onChange({
            validated_filter: e.target.value as "all" | "validated" | "unvalidated"
          })
        }
      >
        <option value="all">All</option>
        <option value="validated">Validated only</option>
        <option value="unvalidated">Unvalidated only</option>
      </select>





      {/* Difficulty */}
      <select
        className="form-select"
        style={{ width: "120px" }}
        value={metadata.difficulty ?? ""}
        onChange={(e) => onChange({ difficulty: e.target.value })}
      >
        <option value="">Difficulty</option>
        <option value="easy">Easy</option>
        <option value="medium">Medium</option>
        <option value="hard">Hard</option>
      </select>

      {/* Subject dropdown */}
      <select
        className="form-select"
        style={{ width: "400px" }}   // adjust as needed
        value={metadata.subject ?? ""}
        onChange={(e) => onSubjectChange(e.target.value)}
      >
        <option value="">All subjects</option>
          {(subjects ?? []).map((subj) => (
            <option key={subj} value={subj}>{subj}</option>
          ))}
      </select>

      <button className="btn btn-outline-primary" onClick={onPrev}>&lt;</button>
      <button className="btn btn-outline-primary" onClick={onNext}>&gt;</button>

      {/* Save button */}
      <button
        type="button"
        className="btn btn-outline-primary"
        onClick={onSave}
        disabled={isSaving}
      >
        {isSaving ? "Saving..." : "Save"}
      </button>

      {saveSuccess && <span style={{ color: "green" }}>Saved successfully</span>}
      {saveError && <span style={{ color: "red" }}>{saveError}</span>}

      <button
        className="btn btn-outline-primary"
        onClick={() => navigate(`/templates/${metadata.id}/metadata`)}
        disabled={!metadata.id}
      >
        Metadata
      </button>

      <button
        onClick={onValidate}
        className={
          metadata.validated
            ? "btn btn-primary"
            : "btn btn-outline-primary"
        }
      >
        {metadata.validated ? "Validated" : "Validate"}
      </button>

      <button
        type="button"
        className="btn btn-outline-primary"
        onClick={handleCopy}
        style={{ minWidth: 80 }}
      >
        {copied ? "Copied!" : "Copy"}
      </button>

      <button
        className="btn btn-outline-success"
        onClick={() => navigate("/templates/new")}
        title="Create template from image"
      >
        +
      </button>
    </div>
  );
}
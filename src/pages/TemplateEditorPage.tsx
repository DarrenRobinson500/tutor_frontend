import debounce from "lodash.debounce";

import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { TemplateMetadataBar } from "./components/TemplateMetadataBar";
import { EditorPanel } from "./components/EditorPanel";
import type { EditorHandle } from "./components/EditorPanel";
import { ParameterHelper } from "./components/ParameterHelper";
import { KnowledgeHelper } from "./components/KnowledgeHelper";
import { ValuesPanel } from "./components/ValuesPanel";
import { PreviewPanel } from "./components/PreviewPanel";
import { Layout } from "./components/Layout";
import { apiFetch } from "../utils/apiFetch"
import { usePreferenceStore } from "../utils/pref";

import { useTemplateApi } from "../api/useTemplateApi";
// import { useValidationApi } from "../api/useValidationApi";
import type { TemplateMetadata } from "../types/TemplateMetadata";

interface PreviewResponse {
  question: string;
  answers: any[];
  params: Record<string, any>;
  solution: string;
  diagram_svg: string;
  diagram_code: string;
  substituted_yaml: string;
}

export function TemplateEditorPage() {
  const [filteredList, setFilteredList] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [skills, setSkills] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const savedValidatedFilter = usePreferenceStore((s) =>
    s.get("template.validated_filter")
  );

  const emptyMetadata = {
    id: null,
    name: "",
    description: "",
    subject: "",
    topic: "",
    subtopic: "",
    difficulty: "",
    grade: "",
    tags: [],
    curriculum: [],
    status: "draft",
    version: 1,
    skill: null,
    validated: false,
    validated_filter: savedValidatedFilter ?? "all",
  };


  const navigate = useNavigate();
  const params = useParams();
  const { id } = params;
  const [searchParams] = useSearchParams();
  const [metadata, setMetadata] = useState<TemplateMetadata>(emptyMetadata);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [content, setContent] = useState<string>("");
  const [validationResult] = useState<any>(null);

  const [previewResult, setPreviewResult] = useState<any>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [showParamHelper, setShowParamHelper] = useState(false);
  const [showKnowledgeHelper, setShowKnowledgeHelper] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAiUpdating, setIsAiUpdating] = useState(false);
  const editorRef = useRef<EditorHandle>(null);
  const { getTemplate, saveTemplate } = useTemplateApi();

function buildMetadataFromTemplate(
  tpl: any,
  currentFilter: "all" | "validated" | "unvalidated"
): TemplateMetadata {
  return {
    id: tpl.id ?? null,
    name: tpl.name ?? "",
    description: tpl.description ?? "",
    subject: tpl.subject ?? "",
    topic: tpl.topic ?? "",
    subtopic: tpl.subtopic ?? "",
    difficulty: tpl.difficulty ?? "",
    grade: tpl.grade ?? null,
    tags: tpl.tags ?? [],
    curriculum: tpl.curriculum ?? [],
    status: tpl.status ?? "draft",
    version: tpl.version ?? 1,
    skill: tpl.skill ?? null,
    validated: tpl.validated ?? false,

    // ⭐ Always preserve the user's validated filter preference
    validated_filter: currentFilter,
  };
}


const handleToggleValidated = async () => {
  if (!metadata.id) return;

  const res = await apiFetch(`/api/templates/${metadata.id}/toggle_validated/`, {
    method: "POST",
  });

  if (!res.ok) {
    alert("Failed to toggle validation");
    return;
  }

  const data = await res.json();
  const currentId = metadata.id;
  const saved = usePreferenceStore.getState().get("template.validated_filter");

  const removedFromFilter =
    (saved === "unvalidated" && data.validated) ||
    (saved === "validated" && !data.validated);

  if (removedFromFilter) {
    const remaining = filteredList.filter(t => t.id !== currentId);
    setFilteredList(remaining);

    if (remaining.length > 0) {
      setCurrentIndex(0);
      navigate(`/templates/${remaining[0].id}`);
    } else {
      setCurrentIndex(0);
      setMetadata(prev => ({ ...prev, id: null, validated: data.validated }));
      setContent("");
      setPreview(null);
      navigate("/templates/editor");
    }
  } else {
    setMetadata(prev => ({ ...prev, validated: data.validated }));
  }
};

  // Debounced function
  const debouncedPreview = useRef(
    debounce(async (content: string, templateId?: number | null) => {
      const res = await apiFetch("/api/templates/preview/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, templateId: templateId ?? null }),
      });

      const data = await res.json();
      console.log("Preview response:", data.preview);
      console.log("Sending content to preview:", content);

      // ⭐ Only update the preview — do NOT modify metadata
      setPreview(data.preview);

    }, 400)
  ).current;

  // Load
  useEffect(() => {
    if (savedValidatedFilter) {
      setMetadata((prev) => ({
        ...prev,
        validated_filter: savedValidatedFilter
      }));
    }
  }, [savedValidatedFilter]);


  useEffect(() => {
    async function load() {
      if (!id) return;

      const tpl = await getTemplate(id);
      if (!tpl) return;

      setContent(tpl.content);
      const currentFilter = usePreferenceStore.getState().get("template.validated_filter") ?? "all";
      setMetadata(prev =>
        buildMetadataFromTemplate(tpl, prev.validated_filter ?? currentFilter)
      );

      // Load the filtered list so subjects/navigation work without needing a filter change
      const queryParams = new URLSearchParams({
        skill: String(tpl.skill ?? ""),
        grade: String(tpl.grade ?? ""),
        difficulty: String(tpl.difficulty ?? ""),
        validated: currentFilter,
      });
      const listRes = await apiFetch(`/api/templates/filtered/?${queryParams.toString()}`);
      const list = await listRes.json();
      setFilteredList(list);
      const idx = list.findIndex((t: any) => t.id === tpl.id);
      setCurrentIndex(idx >= 0 ? idx : 0);

      const res = await apiFetch("/api/templates/preview/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: tpl.content, templateId: tpl.id }),
      });

      const data = await res.json();
      setPreview(data.preview);
    }
    load();
  }, [id]);

  // When arriving on /templates/editor with ?skill=&grade= (e.g. after a delete), apply filters
  useEffect(() => {
    if (id) return; // only applies to the bare editor route
    const skillParam = searchParams.get("skill");
    const gradeParam = searchParams.get("grade");
    if (!skillParam && !gradeParam) return;

    const skill = skillParam ? Number(skillParam) : null;
    const grade = gradeParam ?? "";
    const currentFilter = usePreferenceStore.getState().get("template.validated_filter") ?? "all";

    setMetadata(prev => ({ ...prev, skill, grade, validated_filter: currentFilter }));

    async function loadFiltered() {
      const qp = new URLSearchParams({
        skill: skillParam ?? "",
        grade: gradeParam ?? "",
        validated: currentFilter,
      });
      const listRes = await apiFetch(`/api/templates/filtered/?${qp.toString()}`);
      const list = await listRes.json();
      setFilteredList(list);
      setCurrentIndex(0);
      if (list.length > 0) {
        navigate(`/templates/${list[0].id}`, { replace: true });
      }
    }
    loadFiltered();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load Skills, Subjects
  useEffect(() => {
    async function loadSkills() {
      const grade = metadata.grade ?? "";
      const res = await apiFetch(`/api/skills/leaf/?grade=${grade}`);
      const data = await res.json();
      setSkills(data);
    }
    loadSkills();
  }, [metadata.grade]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (metadata.skill) params.set("skill", String(metadata.skill));
    if (metadata.grade) params.set("grade", String(metadata.grade));
    if (metadata.difficulty) params.set("difficulty", String(metadata.difficulty));
    if (metadata.validated_filter) params.set("validated", String(metadata.validated_filter));
    apiFetch(`/api/templates/subjects/?${params.toString()}`, { signal: controller.signal })
      .then(res => res.json())
      .then(data => setSubjects(data))
      .catch(err => { if (err.name !== "AbortError") console.error("[subjects] error", err); });
    return () => controller.abort();
  }, [metadata.skill, metadata.grade, metadata.difficulty, metadata.validated_filter]);

  // Handle Subject Change
  const handleSubjectChange = (subject: string) => {
    setMetadata(prev => ({ ...prev, subject }));
    if (!subject) {
      // Reset to full filtered list
      setCurrentIndex(0);
      if (filteredList.length > 0) {
        navigate(`/templates/${filteredList[0].id}`);
      }
      return;
    }

  // Filter templates by subject
  const subjectFiltered = filteredList.filter(t => t.subject === subject);
    if (subjectFiltered.length > 0) {
      setCurrentIndex(0);
      navigate(`/templates/${subjectFiltered[0].id}`);
    }
  };

  // Handle Content Change
  function handleContentChange(newContent: string) {
    setContent(newContent);
    debouncedPreview(newContent, metadata.id);
  }

  // Handle going to skill
  const handleToSkill = () => {
    if (metadata.skill) {
      navigate(`/skills/${metadata.skill}`);
    }
  };

  // Handler - Save
  const handleSave = async () => {
    console.log("Save button clicked (TemplateEditorPage) — metadata:", metadata);

  // Build a clean payload that matches the Django Template model
  const payload = {
    name: metadata.name || "",
    description: metadata.description || "",
    subject: metadata.subject || "",
    topic: metadata.topic || "",
    subtopic: metadata.subtopic || "",
    difficulty: metadata.difficulty || "",
    grade: metadata.grade || null,
    tags: metadata.tags || [],
    curriculum: metadata.curriculum || [],
    skill: metadata.skill || null,
    content
  };

  // CREATE
  if (!metadata.id) {
    console.log("Creating new template with payload:", payload);

    const res = await apiFetch("/api/templates/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Template CREATE failed:", errorText);
      alert("Template creation failed. Check console for details.");
      return;
    }

    const data = await res.json();
    console.log("Template created:", data);

    // Store the new ID
    setMetadata(prev => ({ ...prev, id: data.id }));

    // Navigate to the new template page
    navigate(`/templates/${data.id}`);
    return;
  }

  // UPDATE
  console.log("Updating existing template:", metadata.id);

  const res = await apiFetch(`/api/templates/${metadata.id}/`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  // No data yet
  if (!res.ok) {
    const errorText = await res.text();
    console.error("Template UPDATE failed:", errorText);
    alert("Template update failed. Check console for details.");
    return;
  }

  const data = await res.json();
  console.log("Template updated:", data);

  // Update metadata (in case backend modifies anything)
  setMetadata(prev => ({ ...prev, ...data }));
};

  // Delete
  const handleDelete = async () => {
    if (!metadata.id) return;

    const confirmed = window.confirm("Are you sure you want to delete this template?");
    if (!confirmed) return;

    const res = await apiFetch(`/api/templates/${metadata.id}/`, {
      method: "DELETE",
    });

    if (!res.ok) {
      alert("Failed to delete template");
      return;
    }

    // Remove deleted template from the local list
    const remaining = filteredList.filter(t => t.id !== metadata.id);

    if (remaining.length > 0) {
      setFilteredList(remaining);
      setCurrentIndex(0);
      navigate(`/templates/${remaining[0].id}`);
    } else {
      // filteredList may be empty (user navigated directly by URL without applying filters).
      // Fetch from the API to find any other template with the same filters.
      const queryParams = new URLSearchParams({
        skill: String(metadata.skill ?? ""),
        grade: String(metadata.grade ?? ""),
        difficulty: String(metadata.difficulty ?? ""),
        validated: metadata.validated_filter ?? "all",
      });
      const listRes = await apiFetch(`/api/templates/filtered/?${queryParams.toString()}`);
      const list = await listRes.json();
      const others = list.filter((t: any) => t.id !== metadata.id);

      if (others.length > 0) {
        setFilteredList(others);
        setCurrentIndex(0);
        navigate(`/templates/${others[0].id}`);
      } else {
        navigate(`/skills`);
      }
    }
  };



  function handleInsertParameter(yaml: string) {
    const lines = content.split("\n");
    const paramIdx = lines.findIndex(l => l.trim() === "parameters:");

    if (paramIdx >= 0) {
      // Find the end of the parameters block (first non-indented, non-empty line after it)
      let insertIdx = paramIdx + 1;
      while (insertIdx < lines.length && (lines[insertIdx].startsWith("  ") || lines[insertIdx].trim() === "")) {
        insertIdx++;
      }
      const newLines = [
        ...lines.slice(0, insertIdx),
        yaml,
        ...lines.slice(insertIdx),
      ];
      handleContentChange(newLines.join("\n"));
    } else {
      // No parameters block yet — prepend one
      handleContentChange(`parameters:\n${yaml}\n\n${content}`);
    }
  }

  const handlePreview = async () => {
    setPreviewResult({
      text: "This is a preview of your template.\n\nMore features coming soon."
    });
  };

  const handleAiUpdate = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiUpdating(true);
    try {
      const res = await apiFetch("/api/templates/update_with_ai/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, instruction: aiPrompt }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "AI update failed");
        return;
      }
      handleContentChange(data.content);
      setAiPrompt("");
    } catch (e) {
      alert("AI update failed");
    } finally {
      setIsAiUpdating(false);
    }
  };

  const handleCopy = async () => {
    if (!metadata.id) return;
    const res = await apiFetch(`/api/templates/${metadata.id}/duplicate/`, { method: "POST" });
    if (!res.ok) {
      alert("Failed to duplicate template");
      return;
    }
    const data = await res.json();
    navigate(`/templates/${data.id}`);
  };

  const handleMetadataChange = async (updated: Partial<TemplateMetadata>) => {
    const newMeta = { ...metadata, ...updated };
    setMetadata(newMeta);

    if (updated.validated_filter) {
      usePreferenceStore.getState().set(
        "template.validated_filter",
        updated.validated_filter
      );
    }

    // If any of the filters change, reload the list
    if (updated.skill || updated.grade || updated.difficulty || updated.validated_filter) {
      const params = new URLSearchParams({
        skill: String(newMeta.skill ?? ""),
        grade: String(newMeta.grade ?? ""),
        difficulty: String(newMeta.difficulty ?? ""),
        validated: newMeta.validated_filter ?? "all",
      });

      if (updated.grade) {
        const res = await apiFetch(`/api/skills/leaf/?grade=${updated.grade}`);
        const data = await res.json();
        setSkills(data);
      }

      const res = await apiFetch(`/api/templates/filtered/?${params.toString()}`);
      const list = await res.json();

      setFilteredList(list);
      setCurrentIndex(0);

      if (list.length > 0) {
        navigate(`/templates/${list[0].id}`);
      }
    }
  };

  const goNext = () => {
    if (currentIndex < filteredList.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      navigate(`/templates/${filteredList[nextIndex].id}`);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      navigate(`/templates/${filteredList[prevIndex].id}`);
    }
  };

  useEffect(() => {
    console.log("FULL PREVIEW OBJECT:", preview);
  }, [preview]);




  return (
<Layout>
  <div className="template-editor-page">

    {/* Metadata */}
    <TemplateMetadataBar
      metadata={metadata}
      onChange={handleMetadataChange}
      onSave={handleSave}
      onDelete={handleDelete}
      onCopy={handleCopy}
      onValidate={handleToggleValidated}
      onPreview={handlePreview}
      onToSkill={handleToSkill}
      isSaving={isSaving}
      saveError={saveError}
      saveSuccess={saveSuccess}
      onNext={goNext}
      onPrev={goPrev}
      skills={skills}
      subjects={subjects}
      onSubjectChange={handleSubjectChange}
    />

    <div className="container-fluid">
      <div className="row" style={{ height: "70vh" }}>

        {/* Panel 1: Editor (Template source) */}
        <div className="col-md-4 d-flex flex-column" style={{ height: "100%" }}>
          <div className="card shadow-sm flex-grow-1 d-flex flex-column">
            <div className="card-header d-flex justify-content-between align-items-center gap-1">
              <span>Question Definition</span>
              <div className="d-flex gap-1">
                <button
                  className={`btn btn-sm ${showParamHelper ? "btn-primary" : "btn-outline-secondary"}`}
                  style={{ fontSize: 11 }}
                  onClick={() => setShowParamHelper(v => !v)}
                >
                  ＋ Parameter
                </button>
                <button
                  className={`btn btn-sm ${showKnowledgeHelper ? "btn-primary" : "btn-outline-secondary"}`}
                  style={{ fontSize: 11 }}
                  onClick={() => setShowKnowledgeHelper(v => !v)}
                >
                  ＋ Knowledge
                </button>
              </div>
            </div>
            <div className="p-0 d-flex flex-column flex-grow-1" style={{ overflow: "hidden" }}>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <EditorPanel
                  ref={editorRef}
                  content={content}
                  onChange={handleContentChange}
                  validation={validationResult}
                  templateId={id ?? null}
                />
              </div>
              {showParamHelper && (
                <ParameterHelper onInsert={handleInsertParameter} />
              )}
              {showKnowledgeHelper && (
                <KnowledgeHelper templateId={metadata.id ?? null} />
              )}
            </div>
          </div>
        </div>

        {/* Panel 2: Values (Substituted YAML) */}
        <div className="col-md-4 d-flex flex-column" style={{ height: "100%" }}>
          <div className="card shadow-sm flex-grow-1">
            <div className="card-header">Question Definition (Values Populated)</div>
            <div className="card-body overflow-auto">
              <ValuesPanel
                substitutedYaml={preview?.substituted_yaml ?? null}
                diagramCode={preview?.diagram_code ?? null}
                backendSvg={preview?.diagram_svg ?? null}
              />

            </div>
          </div>
        </div>

        {/* Panel 3: Preview (Student view + Diagram) */}
        <div className="col-md-4 d-flex flex-column" style={{ height: "100%" }}>
          <div className="card shadow-sm flex-grow-1">
            <div className="card-header">Student Preview</div>
            <div
              className="card-body p-2 d-flex flex-column"
              style={{ overflow: "hidden" }}
            >
              <PreviewPanel
                preview={preview}
                mode="editor"
                templateContent={content}
                onEditorNext={(newPreview) => {
                  setPreview(newPreview);
//                   goNext();
                }}
              />


            </div>
          </div>
        </div>

      </div>

      {/* AI Prompt — below Panel 1 */}
      <div className="row mt-2">
        <div className="col-md-4">
          <div className="d-flex gap-2 align-items-center">
            <label style={{ fontSize: 12, whiteSpace: "nowrap", margin: 0 }}>AI Prompt</label>
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="e.g. Use the AlgebraTable diagram"
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleAiUpdate(); }}
              disabled={isAiUpdating}
            />
            <button
              className="btn btn-sm btn-primary"
              onClick={handleAiUpdate}
              disabled={isAiUpdating || !aiPrompt.trim()}
              style={{ whiteSpace: "nowrap" }}
            >
              {isAiUpdating ? "Updating…" : "Update Template"}
            </button>
          </div>
        </div>
      </div>
    </div>

  </div>
</Layout>
  );
}
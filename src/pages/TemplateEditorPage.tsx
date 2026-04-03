import debounce from "lodash.debounce";

import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { TemplateMetadataBar } from "./components/TemplateMetadataBar";
import { EditorPanel } from "./components/EditorPanel";
import type { EditorHandle } from "./components/EditorPanel";
import { ParameterHelper } from "./components/ParameterHelper";
import { KnowledgeHelper } from "./components/KnowledgeHelper";
import { DiagramHelper } from "./components/DiagramHelper";
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
    skill_detail_id: null,
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
  const location = useLocation();
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
  const [showDiagramHelper, setShowDiagramHelper] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAiUpdating, setIsAiUpdating] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [notes, setNotes] = useState<any[]>([]);
  const [isAddingNote, setIsAddingNote] = useState(false);
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
    subject: tpl.skill_detail_description ?? "",
    skill_detail_id: tpl.skill_detail ?? null,
    topic: tpl.topic ?? "",
    subtopic: tpl.subtopic ?? "",
    difficulty: tpl.difficulty ?? "",
    grade: tpl.grade ?? null,
    tags: tpl.tags ?? [],
    curriculum: tpl.curriculum ?? [],
    status: tpl.status ?? "draft",
    version: tpl.version ?? 1,
    skill: tpl.skill_id ?? null,
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
        skill: String(tpl.skill_id ?? ""),
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
  }, [id, location.key]);

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
  const subjectFiltered = filteredList.filter(t => t.skill_detail === subject);
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
    topic: metadata.topic || "",
    subtopic: metadata.subtopic || "",
    difficulty: metadata.difficulty || "",
    grade: metadata.grade || null,
    tags: metadata.tags || [],
    curriculum: metadata.curriculum || [],
    skill_detail: metadata.skill_detail_id || null,
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



  function handleAddPart() {
    const lines = content.split("\n");
    const partsIdx = lines.findIndex(l => /^ {2}parts:/.test(l));
    const newPartLines = [
      `    - text: ""`,
      `      answer: ""`,
      `      solution: ""`,
    ];

    if (partsIdx === -1) {
      // No parts yet — insert before answers:/solution: root key, or append
      const insertBefore = lines.findIndex(l => /^(answers|solution):/.test(l));
      const partsBlock = [`  parts:`, ...newPartLines];
      if (insertBefore >= 0) {
        const newLines = [...lines.slice(0, insertBefore), ...partsBlock, ``, ...lines.slice(insertBefore)];
        handleContentChange(newLines.join("\n"));
      } else {
        handleContentChange(content.trimEnd() + "\n" + partsBlock.join("\n") + "\n");
      }
    } else {
      // Find last line belonging to the parts block (4+ space indent)
      let lastPartLine = partsIdx;
      for (let i = partsIdx + 1; i < lines.length; i++) {
        if (lines[i].startsWith("    ")) {
          lastPartLine = i;
        } else if (lines[i].trim() !== "") {
          break;
        }
      }
      const newLines = [...lines.slice(0, lastPartLine + 1), ...newPartLines, ...lines.slice(lastPartLine + 1)];
      handleContentChange(newLines.join("\n"));
    }
  }

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

  function handleInsertKnowledge(snippet: string) {
    const lines = content.split("\n");

    // Find existing post_answer: line
    const paIdx = lines.findIndex(l => /^post_answer:/.test(l));

    if (paIdx >= 0) {
      const line = lines[paIdx];

      if (/^post_answer:\s*\|/.test(line)) {
        // Already a block scalar — find end and append
        let endIdx = paIdx + 1;
        while (endIdx < lines.length) {
          const el = lines[endIdx];
          if (el.trim() === "" || el.startsWith("  ")) { endIdx++; continue; }
          break;
        }
        while (endIdx > paIdx + 1 && lines[endIdx - 1].trim() === "") endIdx--;
        const newLines = [...lines];
        newLines.splice(endIdx, 0, `  ${snippet}`);
        handleContentChange(newLines.join("\n"));
      } else {
        // Inline value — extract existing content and convert to block scalar
        const existingVal = line.replace(/^post_answer:\s*/, "").replace(/^["']|["']$/g, "").trim();
        const newLines = [...lines];
        const replacement = existingVal
          ? [`post_answer: |`, `  ${existingVal}`, `  ${snippet}`]
          : [`post_answer: |`, `  ${snippet}`];
        newLines.splice(paIdx, 1, ...replacement);
        handleContentChange(newLines.join("\n"));
      }
      return;
    }

    // No post_answer yet — append after the last top-level line
    handleContentChange(content.trimEnd() + `\npost_answer: '${snippet}'\n`);
  }

  function handleInsertDiagram(yaml: string) {
    const lines = content.split("\n");
    // Replace existing diagram: line if present
    const existingIdx = lines.findIndex(l => l.trimStart().startsWith("diagram:"));
    if (existingIdx >= 0) {
      const newLines = [...lines];
      newLines[existingIdx] = yaml;
      handleContentChange(newLines.join("\n"));
      return;
    }
    // Insert before answers: or solution: or at end of file
    const insertBefore = lines.findIndex(l => /^(answers|solution):/.test(l.trim()));
    if (insertBefore >= 0) {
      const newLines = [...lines.slice(0, insertBefore), yaml, "", ...lines.slice(insertBefore)];
      handleContentChange(newLines.join("\n"));
    } else {
      handleContentChange(content + "\n" + yaml);
    }
  }

  const handlePreview = async () => {
    setPreviewResult({
      text: "This is a preview of your template.\n\nMore features coming soon."
    });
  };

  const handleAiUpdate = async (pro = false) => {
    if (!aiPrompt.trim()) return;
    setIsAiUpdating(true);
    try {
      const res = await apiFetch("/api/templates/update_with_ai/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, instruction: aiPrompt, pro }),
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

  const handleCopyHarder = async () => {
    if (!metadata.id) return;
    const NEXT: Record<string, string> = { easy: "medium", medium: "hard" };
    if (!NEXT[metadata.difficulty]) {
      alert("This template is already at Hard difficulty.");
      return;
    }
    const res = await apiFetch(`/api/templates/${metadata.id}/duplicate_harder/`, { method: "POST" });
    if (!res.ok) {
      alert("Failed to create harder version");
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
    const isFilterChange = "skill" in updated || "grade" in updated || "difficulty" in updated || "validated_filter" in updated;
    if (isFilterChange) {
      const params = new URLSearchParams();
      if (newMeta.skill) params.set("skill", String(newMeta.skill));
      if (newMeta.grade) params.set("grade", String(newMeta.grade));
      if (newMeta.difficulty) params.set("difficulty", String(newMeta.difficulty));
      params.set("validated", newMeta.validated_filter ?? "all");

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
        const currentSubject = newMeta.subject;
        const subjectMatch = currentSubject
          ? list.find((t: any) => t.skill_detail === currentSubject)
          : null;
        const target = subjectMatch ?? list[0];
        navigate(`/templates/${target.id}`);
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

  useEffect(() => {
    if (!metadata.id) { setNotes([]); return; }
    apiFetch(`/api/notes/?template=${metadata.id}`)
      .then(r => r.json())
      .then(data => setNotes(Array.isArray(data) ? data : (data.results ?? [])))
      .catch(() => {});
  }, [metadata.id]);

  const handleDeleteNote = async (noteId: number) => {
    await apiFetch(`/api/notes/${noteId}/`, { method: "DELETE" });
    setNotes(prev => prev.filter(n => n.id !== noteId));
  };

  const handleAddNote = async () => {
    if (!noteText.trim() || !metadata.id) return;
    setIsAddingNote(true);
    try {
      const res = await apiFetch("/api/notes/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: metadata.id, text: noteText.trim() }),
      });
      if (res.ok) {
        const note = await res.json();
        setNotes(prev => [note, ...prev]);
        setNoteText("");
      }
    } finally {
      setIsAddingNote(false);
    }
  };




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
      onCopyHarder={handleCopyHarder}
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
      <div className="row" style={{ minHeight: "70vh" }}>

        {/* Panel 1: Editor (Template source) */}
        <div className="col-md-4 d-flex flex-column">
          <div className="card shadow-sm flex-grow-1 d-flex flex-column">
            <div className="card-header d-flex justify-content-between align-items-start gap-1 flex-wrap">
              <span>Question</span>
              <div className="d-flex gap-1 flex-wrap justify-content-end">
                <button
                  className="btn btn-sm btn-outline-secondary"
                  style={{ fontSize: 11 }}
                  onClick={handleAddPart}
                >
                  ＋ Part
                </button>
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
                <button
                  className={`btn btn-sm ${showDiagramHelper ? "btn-primary" : "btn-outline-secondary"}`}
                  style={{ fontSize: 11 }}
                  onClick={() => setShowDiagramHelper(v => !v)}
                >
                  ＋ Diagram
                </button>
                <button
                  className="btn btn-sm btn-outline-secondary"
                  style={{ fontSize: 11 }}
                  title="Remove title, years, difficulty, skill_id keys from content"
                  onClick={() => {
                    const metadataKeys = new Set(["title", "years", "difficulty", "skill_id", "introduction", "worked_example"]);
                    const lines = content.split("\n");
                    const result: string[] = [];
                    let skipping = false;
                    for (const line of lines) {
                      const isBlank = line.trim() === "";
                      const isIndented = line.startsWith(" ") || line.startsWith("\t");
                      const keyMatch = !isIndented && line.match(/^([a-zA-Z_]\w*)\s*:/);
                      if (keyMatch) {
                        if (metadataKeys.has(keyMatch[1])) {
                          skipping = true; // remove this line and any indented continuations
                        } else {
                          skipping = false;
                          result.push(line);
                        }
                      } else if (skipping && (isIndented || isBlank)) {
                        // continuation of a metadata value — skip
                      } else {
                        skipping = false;
                        result.push(line);
                      }
                    }
                    let stripped = result.join("\n").replace(/\n{3,}/g, "\n\n").trimStart();
                    // Convert solution/question from JSON object form to inline string:
                    //   solution:\n  {\n  "text": "..."\n  }  →  solution: "..."
                    stripped = stripped.replace(
                      /^(solution|question):[ \t]*\n[ \t]*\{[ \t]*\n[ \t]*"text":[ \t]*"((?:[^"\\]|\\.)*)"[ \t]*\n[ \t]*\}/gm,
                      '$1: "$2"'
                    );
                    setContent(stripped);
                    debouncedPreview(stripped, metadata.id);
                  }}
                >
                  Strip Metadata
                </button>
              </div>
            </div>
            <div style={{ height: 570, overflow: "hidden", flexShrink: 0 }}>
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
            {showDiagramHelper && (
              <DiagramHelper onInsert={handleInsertDiagram} />
            )}
            {showKnowledgeHelper && (
              <KnowledgeHelper
                templateId={metadata.id ?? null}
                onInsert={handleInsertKnowledge}
                onKnowledgeChange={async () => {
                  const res = await apiFetch("/api/templates/preview/", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ content, templateId: metadata.id }),
                  });
                  const data = await res.json();
                  if (data.preview) setPreview(data.preview);
                }}
              />
            )}
          </div>
        </div>

        {/* Panel 2: Values (Substituted YAML) */}
        <div className="col-md-4 d-flex flex-column">
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
        <div className="col-md-4 d-flex flex-column">
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
              onClick={() => handleAiUpdate(false)}
              disabled={isAiUpdating || !aiPrompt.trim()}
              style={{ whiteSpace: "nowrap" }}
            >
              {isAiUpdating ? "Updating…" : "Update"}
            </button>
            <button
              className="btn btn-sm btn-success"
              onClick={() => handleAiUpdate(true)}
              disabled={isAiUpdating || !aiPrompt.trim()}
              style={{ whiteSpace: "nowrap" }}
            >
              {isAiUpdating ? "Updating…" : "Update+"}
            </button>
          </div>
        </div>
      </div>

      {/* Notes — below AI Prompt */}
      {metadata.id && (
        <div className="row mt-2">
          <div className="col-md-4">
            <div className="d-flex gap-2 align-items-center">
              <label style={{ fontSize: 12, whiteSpace: "nowrap", margin: 0 }}>Note</label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Add a note about this template…"
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleAddNote(); }}
                disabled={isAddingNote}
              />
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={handleAddNote}
                disabled={isAddingNote || !noteText.trim()}
                style={{ whiteSpace: "nowrap" }}
              >
                Add Note
              </button>
            </div>
            {notes.length > 0 && (
              <div className="mt-1">
                {notes.map(n => (
                  <div key={n.id} className="text-muted border-bottom py-1 d-flex justify-content-between align-items-start" style={{ fontSize: 11 }}>
                    <span>{n.text}</span>
                    <button
                      onClick={() => handleDeleteNote(n.id)}
                      style={{ background: "none", border: "none", padding: "0 0 0 6px", cursor: "pointer", color: "#999", fontSize: 13, lineHeight: 1, flexShrink: 0 }}
                      title="Delete note"
                    >×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>

  </div>
</Layout>
  );
}
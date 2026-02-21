import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Layout } from "./components/Layout";
import { apiFetch } from "../utils/apiFetch";
import { PreviewPanel } from "./components/PreviewPanel";
import type { PreviewResponse } from "../types/PreviewResponse";
import type { StudentRecordResponse } from "../types/PreviewResponse";

export function StudentQuestionPage() {
  const { studentId, skillId } = useParams();
  const [current, setCurrent] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [skillName, setSkillName] = useState("");
  const [mastery, setMastery] = useState<number | null>(null);
  const [competence, setCompetence] = useState("");
  const [templateId, setTemplateId] = useState<number | undefined>(undefined);

  useEffect(() => {
    async function loadInitial() {
      setLoading(true);

      const res = await apiFetch("/api/questions/record/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          skill_id: skillId,
          count: 1
        })
      });

      const data = await res.json();

      setTemplateId(data.template_id);
      setCurrent(data.next_question);
      setSkillName(data.next_question.skill);
      setMastery(data.mastery);
      setCompetence(data.competence_label);
      setLoading(false);
    }

    loadInitial();
  }, [studentId, skillId]);

  if (loading || !current) {
    return (
      <Layout>
        <div className="container mt-4">Loading question…</div>
      </Layout>
    );
  }

return (
  <Layout>
    <div className="container mt-4">

      {current && (
        <div className="row justify-content-center">
          <div className="col-md-4">
      <h2>{skillName} ({competence}) {mastery}</h2>
      <hr/>
            <PreviewPanel
              preview={current}
              mode="student"
              studentId={Number(studentId)}
              templateId={templateId!}
              onStudentNext={(result: StudentRecordResponse) => {
                console.log("About to update templateId to:", result.template_id);
                setTemplateId(result.template_id);
                setCurrent(result.next_question);
                setMastery(result.mastery);
                setCompetence(result.competence_label);
              }}
            />
          </div>
        </div>
      )}

    </div>
  </Layout>
);
}
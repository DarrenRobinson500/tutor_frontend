import { useEffect, useState } from "react";
import { PreviewPanel } from "./components/PreviewPanel";
import { getTemplatesForSkill, updateTemplateDifficulty } from "../api";

export default function StudentQuestionPage() {
    const { skillId } = useParams();
    const [questions, setQuestions] = useState<Template[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [correctCount, setCorrectCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            const templates = await getTemplatesForSkill(skillId);
            const selected = templates.slice(0, 5); // simple selection for now
            setQuestions(selected);
            setLoading(false);
        }
        load();
    }, [skillId]);

    async function handleAnswer(correct: boolean) {
        const template = questions[currentIndex];

        if (correct) {
            setCorrectCount(c => c + 1);
            await updateTemplateDifficulty(template.id, template.difficulty + 1);
        } else {
            await updateTemplateDifficulty(template.id, template.difficulty - 1);
        }

        setCurrentIndex(i => i + 1);
    }

    if (loading) return <p>Loading…</p>;

    if (currentIndex >= questions.length) {
        return (
            <div>
                <h2>Test Complete</h2>
                <p>You answered {correctCount} of {questions.length} correctly.</p>
            </div>
        );
    }

    return (
        <PreviewPanel
            template={questions[currentIndex]}
            onAnswer={handleAnswer}
        />
    );
}
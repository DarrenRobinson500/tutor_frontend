import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { apiFetch } from "../../utils/apiFetch";

const COMPETENCE = ["Developing", "Emerging", "Competent", "Mastered"];
const COLORS = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#db2777", "#0891b2", "#ea580c"];

interface Snapshot {
  date: string;
  mastery: number;
  competence_label: string;
  competence_level: number;
}

interface SkillProgress {
  id: number;
  description: string;
  snapshots: Snapshot[];
}

export function ProgressChart({ studentId }: { studentId: number | string }) {
  const [skills, setSkills] = useState<SkillProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/students/${studentId}/progress/`)
      .then(r => r.json())
      .then(data => setSkills(data.skills ?? []))
      .catch(() => setSkills([]))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) {
    return <p className="text-muted" style={{ fontSize: 13 }}>Loading progress…</p>;
  }

  const hasData = skills.some(s => s.snapshots.length > 0);
  if (!hasData) {
    return (
      <p className="text-muted" style={{ fontSize: 13 }}>
        Progress will appear here after tutoring sessions are completed.
      </p>
    );
  }

  // Collect all unique dates in order
  const dateSet: Record<string, true> = {};
  skills.forEach(s => s.snapshots.forEach(sn => { dateSet[sn.date] = true; }));
  const allDates = Object.keys(dateSet).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  // Build recharts format: [{date, "Skill A": level, "Skill B": level, ...}]
  const chartData = allDates.map(date => {
    const point: Record<string, any> = { date };
    for (const skill of skills) {
      const snap = skill.snapshots.find(sn => sn.date === date);
      if (snap !== undefined) point[skill.description] = snap.competence_level;
    }
    return point;
  });

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis
          domain={[0, 3]}
          ticks={[0, 1, 2, 3]}
          tickFormatter={(v: number) => COMPETENCE[v] ?? ""}
          tick={{ fontSize: 11 }}
          width={85}
        />
        <Tooltip
          formatter={(value: any, name: any) => [COMPETENCE[value as number] ?? value, name]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {skills.map((skill, i) => (
          <Line
            key={skill.id}
            type="monotone"
            dataKey={skill.description}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2}
            dot={{ r: 4 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

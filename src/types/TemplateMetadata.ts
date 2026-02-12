export interface TemplateSummary {
  id: number;
  grade: string;
  skill: string;
  difficulty: string
  subject: string
  status: string;
  updated_at: string;
}


export type TemplateMetadata = {
  id: number | null;
  name: string;
  description: string;
  subject: string;
  topic: string;
  subtopic: string;
  difficulty: string;
  grade: string | null;
  tags: string[];
  curriculum: any[];
  status: string;
  version: number;
  skill: number | null;
}

export const emptyMetadata: TemplateMetadata = {
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

};


export interface PreviewResponse {
  question: string;
  answers: any[];
  params: Record<string, any>;
  solution: string;
  diagram_svg: string;
  diagram_code: string;
  substituted_yaml: string;
  errors?: string[];
}

export interface StudentRecordResponse {
  next_question: PreviewResponse;
  mastery: number;
  competence_label: string;
  skill_name: string;
  template_id: number;
}


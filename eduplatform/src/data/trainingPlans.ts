export interface TrainingSection {
  title: string;
  description?: string;
  trainings: string[];
}

export interface TrainingPlan {
  id: string;
  title: string;
  description: string;
  sections: TrainingSection[];
}

export const TRAINING_PLANS: Record<string, TrainingPlan> = {};

import { WorkflowRouteName } from '../types';

export interface ResearchArtifactSpec {
  kind: string;
  label: string;
  path: string;
  summary: string;
}

export interface ResearchPreparationResult {
  prompt: string;
  agentName: string;
  artifactDir: string;
  artifacts: ResearchArtifactSpec[];
}

export interface PrepareResearchWorkflowOptions {
  route: Extract<WorkflowRouteName, 'research_idea' | 'research_plan'>;
  requestText: string;
  userId: string;
  jobId: string;
  workingDir: string;
  defaultAgent: string;
  availableAgents: string[];
}

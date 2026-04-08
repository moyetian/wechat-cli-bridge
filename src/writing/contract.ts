import { WorkflowRouteName } from '../types';

export interface WritingArtifactSpec {
  kind: string;
  label: string;
  path: string;
  summary: string;
}

export interface WritingPreparationResult {
  status: 'ready' | 'integration_missing' | 'completed_local';
  prompt?: string;
  agentName?: string;
  artifactDir?: string;
  artifacts: WritingArtifactSpec[];
  message?: string;
}

export interface PrepareWritingWorkflowOptions {
  route: Extract<WorkflowRouteName, 'article_create' | 'article_edit'>;
  requestText: string;
  userId: string;
  jobId: string;
  workingDir: string;
  defaultAgent: string;
  availableAgents: string[];
}

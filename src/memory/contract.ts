import { WorkflowGateLevel, WorkflowLane, WorkflowRouteName } from '../types';

export type MemoryLoadProfile = 'quick' | 'standard' | 'deep';
export type MemoryTier = 'hot' | 'warm' | 'cold';

export interface MemoryLoadRequest {
  userId: string;
  task?: string;
  route?: WorkflowRouteName;
  lane?: WorkflowLane;
  gate?: WorkflowGateLevel;
  profile?: MemoryLoadProfile;
}

export interface MemoryEntry {
  tier: MemoryTier;
  label: string;
  content: string;
}

export interface MemoryBundle {
  profile: MemoryLoadProfile;
  entries: MemoryEntry[];
  rendered: string;
  rationale: string;
}

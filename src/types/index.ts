// Type definitions for wechat-cli-bridge

// ============================================================================
// Agent Types
// ============================================================================

export type AgentType = 'cli' | 'sdk' | 'http';

export interface AgentConfig {
  /** Agent type: cli, sdk, or http */
  type: AgentType;
  /** CLI command or SDK package name */
  command?: string;
  /** Additional arguments */
  args?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Execution timeout in ms */
  timeout?: number;
  /** Whether to resume session */
  sessionResume?: boolean;
  /** Model name (for SDK type) */
  model?: string;
  /** SDK package path */
  package?: string;
  /** HTTP endpoint (for HTTP type) */
  endpoint?: string;
  /** API key (for HTTP type) */
  apiKey?: string;
}

export interface ExecuteOptions {
  /** Context summary from previous sessions */
  context?: string;
  /** Working directory */
  workingDir: string;
  /** Session ID for resume */
  sessionId?: string;
  /** Project information */
  projectInfo?: ProjectInfo;
}

export interface ExecuteResult {
  /** Success status */
  success: boolean;
  /** Output text */
  output: string;
  /** Error message if failed */
  error?: string;
  /** Summary for context */
  summary: string;
  /** State changes */
  state?: Record<string, unknown>;
  /** Files modified */
  filesModified?: string[];
  /** Whether permission is needed */
  needsPermission?: boolean;
  /** Permission request details */
  permissionRequest?: PermissionRequest;
}

export interface PermissionRequest {
  /** Tool name */
  tool: string;
  /** Action description */
  action: string;
  /** File path if applicable */
  file?: string;
  /** Timeout in seconds */
  timeout: number;
}

// ============================================================================
// Context Types
// ============================================================================

export interface SessionContext {
  /** User ID */
  userId: string;
  /** Session ID */
  sessionId: string;
  /** Default agent */
  defaultAgent: string;
  /** Current working directory */
  workingDir: string;
  /** Project name */
  projectName?: string;
  /** Context summary */
  summary: string;
  /** Current state */
  state: ContextState;
  /** Last activity timestamp */
  lastActivity: Date;
  /** Permission mode */
  permissionMode: PermissionMode;
}

export interface ContextState {
  /** Current phase/task */
  currentTask?: string;
  /** Completed tasks */
  completedTasks: TaskRecord[];
  /** Pending items */
  pendingItems: string[];
  /** Decisions made */
  decisions: Decision[];
  /** Blockers */
  blockers: string[];
  /** Last modified files */
  recentFiles: string[];
}

export interface TaskRecord {
  /** Task description */
  task: string;
  /** Timestamp */
  timestamp: Date;
  /** Result summary */
  result: string;
  /** Agent used */
  agent: string;
  /** Success */
  success: boolean;
}

export interface Decision {
  /** What was decided */
  decision: string;
  /** Rationale */
  rationale?: string;
  /** Timestamp */
  timestamp: Date;
}

export interface ProjectInfo {
  /** Project name */
  name: string;
  /** Project root */
  root: string;
  /** Tech stack */
  techStack?: string[];
  /** Description */
  description?: string;
}

// ============================================================================
// Message Types
// ============================================================================

export interface WeChatMessage {
  /** Message ID */
  id: string;
  /** Sender user ID */
  from: string;
  /** Message content */
  text: string;
  /** Message type */
  type: 'text' | 'image' | 'file';
  /** Timestamp */
  timestamp: Date;
  /** Context token for reply (required by iLink API) */
  contextToken?: string;
  /** Image URL if type is image */
  imageUrl?: string;
  /** File info if type is file */
  fileInfo?: {
    name: string;
    url: string;
    size: number;
  };
}

export interface SendMessage {
  /** Recipient user ID */
  to: string;
  /** Message content */
  text: string;
  /** Message type */
  type?: 'text' | 'markdown';
  /** Context token from received message (required for proper context threading) */
  contextToken?: string;
}

export interface ParsedCommand {
  /** Whether it's a command */
  isCommand: boolean;
  /** Command name */
  command?: string;
  /** Command arguments */
  args?: string[];
  /** Task content */
  task?: string;
  /** Target agent */
  targetAgent?: string;
}

// ============================================================================
// Config Types
// ============================================================================

export type PermissionMode = 'interactive' | 'acceptEdits' | 'auto' | 'plan';

export interface BridgeConfig {
  /** Default agent */
  defaultAgent: string;
  /** Default working directory */
  workingDirectory: string;
  /** Agent configurations */
  agents: Record<string, AgentConfig>;
  /** Context settings */
  context: {
    maxHistory: number;
    summarizeThreshold: number;
    stateFile: boolean;
  };
  /** Permission settings */
  permission: {
    mode: PermissionMode;
    timeout: number;
  };
  /** iLink settings */
  ilink: {
    pollInterval: number;
    timeout: number;
  };
}

// ============================================================================
// Logger Types
// ============================================================================

export interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: Record<string, unknown>;
}

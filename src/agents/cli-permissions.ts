import { AgentConfig, CLIInvocationMode, PermissionMode } from '../types';
import { DEFAULT_PERMISSION_MODE } from '../permissions/contract';

export interface CLIInvocationPlan {
  args: string[];
  invocationMode: CLIInvocationMode;
  promptViaStdin: boolean;
}

const DEFAULT_INVOCATION_MODE: CLIInvocationMode = 'positional';

function getManagedArgSequences(config: AgentConfig): string[][] {
  const profile = config.permissionProfile;
  const sequences: string[][] = [];

  if (!profile) {
    return sequences;
  }

  if (profile.promptArgs && profile.promptArgs.length > 0) {
    sequences.push(profile.promptArgs);
  }

  if (profile.permissionArgs) {
    for (const args of Object.values(profile.permissionArgs)) {
      if (args && args.length > 0) {
        sequences.push(args);
      }
    }
  }

  return sequences;
}

function stripManagedArgs(args: string[], managedSequences: string[][]): string[] {
  const remaining = [...args];

  for (const sequence of managedSequences) {
    if (sequence.length === 0) {
      continue;
    }

    let searchIndex = 0;
    while (searchIndex <= remaining.length - sequence.length) {
      const matches = sequence.every(
        (token, index) => remaining[searchIndex + index] === token
      );

      if (matches) {
        remaining.splice(searchIndex, sequence.length);
      } else {
        searchIndex += 1;
      }
    }
  }

  return remaining;
}

export function getEffectivePermissionMode(
  permissionMode: PermissionMode = DEFAULT_PERMISSION_MODE,
  bridgeApproved: boolean = false
): PermissionMode {
  if (bridgeApproved) {
    return 'auto';
  }

  return permissionMode;
}

export function buildCLIInvocationPlan(
  config: AgentConfig,
  input: string,
  permissionMode: PermissionMode = DEFAULT_PERMISSION_MODE,
  bridgeApproved: boolean = false
): CLIInvocationPlan {
  const profile = config.permissionProfile;
  const invocationMode = profile?.invocationMode || DEFAULT_INVOCATION_MODE;
  const promptArgs = profile?.promptArgs || [];
  const effectivePermissionMode = getEffectivePermissionMode(
    permissionMode,
    bridgeApproved
  );
  const permissionArgs =
    profile?.permissionArgs?.[effectivePermissionMode] || [];
  const managedArgSequences = getManagedArgSequences(config);
  const baseArgs = stripManagedArgs(config.args || [], managedArgSequences);
  const isMultiline = input.includes('\n') || input.includes('\r');

  if (invocationMode === 'prompt_flag') {
    return {
      args: [
        ...baseArgs,
        ...permissionArgs,
        ...promptArgs,
        ...(isMultiline ? [] : [input]),
      ],
      invocationMode,
      promptViaStdin: isMultiline,
    };
  }

  if (isMultiline) {
    return {
      args: [...baseArgs, ...permissionArgs, ...promptArgs],
      invocationMode,
      promptViaStdin: true,
    };
  }

  return {
    args: [...baseArgs, ...permissionArgs, input],
    invocationMode,
    promptViaStdin: false,
  };
}

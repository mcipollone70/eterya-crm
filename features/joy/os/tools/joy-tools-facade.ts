/**
 * Centralized tools registry usage for Joy OS.
 */

export {
  JOY_READ_TOOLS,
  JOY_WRITE_OPERATIONS,
  type JoyReadToolName,
  type JoyWriteOperationName,
} from "@/features/joy/tools/joy-tools-registry";

export {
  JOY_INSUFFICIENT_DATA_MESSAGE,
} from "@/features/joy/tools";

/** Canonical mutation rule: never auto-save without explicit agent confirmation. */
export const JOY_OS_MUTATION_POLICY = {
  autoSave: false,
  requireConfirmation: true,
  inventData: false,
} as const;

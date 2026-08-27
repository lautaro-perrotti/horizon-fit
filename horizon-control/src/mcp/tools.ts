/** MCP adapter surface: registered tool names only. Business logic lives in core/commands. */
import { ALL_TOOLS, DENIED_TOOLS } from "../config.js";
import type { ToolName } from "../types.js";

/**
 * Cursor and other LLM clients reject MCP tool names that fall outside
 * `^[a-zA-Z0-9_-]{1,64}$` (dots are invalid). The spec still allows dots, so
 * `/v1` command names stay dotted while the MCP wire names use underscores.
 */
export const MCP_TOOL_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

export function mcpToolName(tool: ToolName): string {
  return tool.replaceAll(".", "_");
}

export const MCP_TOOL_NAMES: string[] = ALL_TOOLS.map(mcpToolName);

const MCP_NAME_TO_COMMAND: Record<string, ToolName> = Object.fromEntries(
  ALL_TOOLS.map((tool) => [mcpToolName(tool), tool]),
);

export function commandFromMcpName(name: string): ToolName | undefined {
  if ((ALL_TOOLS as string[]).includes(name)) {
    return name as ToolName;
  }
  return MCP_NAME_TO_COMMAND[name];
}

export function listRegisteredTools(): string[] {
  return [...MCP_TOOL_NAMES];
}

export function denyList(): readonly string[] {
  return DENIED_TOOLS;
}

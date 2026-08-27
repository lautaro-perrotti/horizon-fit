/** MCP adapter surface: registered tool names only. Business logic lives in core/commands. */
import { ALL_TOOLS, DENIED_TOOLS } from "../config.js";

export function listRegisteredTools(): string[] {
  return [...ALL_TOOLS];
}

export function denyList(): readonly string[] {
  return DENIED_TOOLS;
}

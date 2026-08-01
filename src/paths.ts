import { homedir } from "node:os";
import { join } from "node:path";

/** Resolve pi agent dir (default ~/.pi/agent). Override with PI_AGENT_DIR for tests. */
export function getAgentDir(override?: string): string {
  if (override) return override;
  if (process.env.PI_AGENT_DIR) return process.env.PI_AGENT_DIR;
  return join(homedir(), ".pi", "agent");
}

export function modelsPath(agentDir?: string): string {
  return join(getAgentDir(agentDir), "models.json");
}

export function authPath(agentDir?: string): string {
  return join(getAgentDir(agentDir), "auth.json");
}

export function settingsPath(agentDir?: string): string {
  return join(getAgentDir(agentDir), "settings.json");
}

export function sidecarPath(agentDir?: string): string {
  return join(getAgentDir(agentDir), "pi-providers.json");
}

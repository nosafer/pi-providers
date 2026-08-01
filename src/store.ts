import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { authPath, modelsPath, settingsPath, sidecarPath } from "./paths.ts";
import type {
  AuthFile,
  KeyMode,
  ModelEntry,
  ModelsFile,
  ModelsProviderConfig,
  ProviderApi,
  SettingsFile,
  SidecarFile,
} from "./types.ts";
import { PROVIDER_ID_RE } from "./types.ts";

const EMPTY_SIDECAR: SidecarFile = {
  version: 1,
  managedProviders: [],
  providers: {},
};

export function readJsonFile<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return structuredClone(fallback);
  try {
    const raw = readFileSync(path, "utf8");
    if (!raw.trim()) return structuredClone(fallback);
    return JSON.parse(raw) as T;
  } catch (err) {
    throw new Error(`Failed to read JSON ${path}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export function writeJsonAtomic(path: string, data: unknown, mode?: number): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp.${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
  if (mode !== undefined) {
    try {
      chmodSync(path, mode);
    } catch {
      // best-effort on platforms without chmod
    }
  }
}

export function loadSidecar(agentDir?: string): SidecarFile {
  const data = readJsonFile<SidecarFile>(sidecarPath(agentDir), EMPTY_SIDECAR);
  if (data.version !== 1) {
    return {
      version: 1,
      managedProviders: data.managedProviders ?? [],
      providers: data.providers ?? {},
    };
  }
  return {
    version: 1,
    managedProviders: [...(data.managedProviders ?? [])],
    providers: { ...(data.providers ?? {}) },
  };
}

export function saveSidecar(data: SidecarFile, agentDir?: string): void {
  writeJsonAtomic(sidecarPath(agentDir), data);
}

export function loadModels(agentDir?: string): ModelsFile {
  return readJsonFile<ModelsFile>(modelsPath(agentDir), { providers: {} });
}

export function saveModels(data: ModelsFile, agentDir?: string): void {
  writeJsonAtomic(modelsPath(agentDir), data);
}

export function loadAuth(agentDir?: string): AuthFile {
  return readJsonFile<AuthFile>(authPath(agentDir), {});
}

export function saveAuth(data: AuthFile, agentDir?: string): void {
  writeJsonAtomic(authPath(agentDir), data, 0o600);
}

export function loadSettings(agentDir?: string): SettingsFile {
  return readJsonFile<SettingsFile>(settingsPath(agentDir), {});
}

export function saveSettings(data: SettingsFile, agentDir?: string): void {
  writeJsonAtomic(settingsPath(agentDir), data);
}

export function isManaged(id: string, agentDir?: string): boolean {
  return loadSidecar(agentDir).managedProviders.includes(id);
}

export function listManaged(agentDir?: string): string[] {
  return [...loadSidecar(agentDir).managedProviders];
}

export interface UpsertManagedInput {
  id: string;
  displayName: string;
  baseUrl: string;
  api: ProviderApi;
  keyMode: KeyMode;
  apiKey?: string;
  envVar?: string;
  models: ModelEntry[];
}

export function upsertManagedProvider(input: UpsertManagedInput, agentDir?: string): void {
  if (!PROVIDER_ID_RE.test(input.id)) {
    throw new Error(`Invalid provider id: ${input.id}`);
  }
  if (input.keyMode === "literal" && !input.apiKey) {
    throw new Error("apiKey required for literal key mode");
  }
  if (input.keyMode === "env" && !input.envVar) {
    throw new Error("envVar required for env key mode");
  }

  const models = loadModels(agentDir);
  models.providers ??= {};
  const existing = models.providers[input.id];
  if (existing && !isManaged(input.id, agentDir)) {
    throw new Error(`Provider "${input.id}" exists and is not managed by pi-providers`);
  }

  const providerConfig: ModelsProviderConfig = {
    baseUrl: input.baseUrl,
    api: input.api,
    models: input.models,
  };

  if (input.keyMode === "env") {
    const envName = input.envVar!.replace(/^\$/, "");
    providerConfig.apiKey = `$${envName}`;
  }

  models.providers[input.id] = providerConfig;
  saveModels(models, agentDir);

  const auth = loadAuth(agentDir);
  if (input.keyMode === "literal") {
    auth[input.id] = { type: "api_key", key: input.apiKey! };
    saveAuth(auth, agentDir);
  } else if (auth[input.id]) {
    delete auth[input.id];
    if (Object.keys(auth).length === 0) {
      const p = authPath(agentDir);
      if (existsSync(p)) unlinkSync(p);
    } else {
      saveAuth(auth, agentDir);
    }
  }
  // env mode and no prior auth: leave auth.json absent

  const side = loadSidecar(agentDir);
  const now = new Date().toISOString();
  const prev = side.providers[input.id];
  if (!side.managedProviders.includes(input.id)) {
    side.managedProviders.push(input.id);
  }
  side.providers[input.id] = {
    displayName: input.displayName,
    selectedModelIds: input.models.map((m) => m.id),
    api: input.api,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  };
  saveSidecar(side, agentDir);
}

export function deleteManagedProvider(id: string, agentDir?: string): void {
  if (!isManaged(id, agentDir)) {
    throw new Error(`Provider "${id}" is not managed by pi-providers`);
  }

  const models = loadModels(agentDir);
  if (models.providers?.[id]) {
    delete models.providers[id];
    saveModels(models, agentDir);
  }

  const auth = loadAuth(agentDir);
  if (auth[id]) {
    delete auth[id];
    saveAuth(auth, agentDir);
  }

  const side = loadSidecar(agentDir);
  side.managedProviders = side.managedProviders.filter((x) => x !== id);
  delete side.providers[id];
  saveSidecar(side, agentDir);
}

export function setDefaultModel(provider: string, modelId: string, agentDir?: string): void {
  const settings = loadSettings(agentDir);
  settings.defaultProvider = provider;
  settings.defaultModel = modelId;
  saveSettings(settings, agentDir);
}

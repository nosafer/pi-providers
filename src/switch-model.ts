import type { ModelRegistry } from "@earendil-works/pi-coding-agent";

export async function switchModel(opts: {
  providerId: string;
  modelId: string;
  setAsDefault: boolean;
  pi: { setModel: (m: unknown) => Promise<boolean> };
  modelRegistry: Pick<ModelRegistry, "find">;
  setDefault: (provider: string, modelId: string) => void;
}): Promise<{ ok: boolean; message: string }> {
  // find() reads the live snapshot. registerProvider already wrote it;
  // a default refresh() would probe every provider on the network.
  const model = opts.modelRegistry.find(opts.providerId, opts.modelId);
  if (!model) {
    return {
      ok: false,
      message: `模型未进入目录: ${opts.providerId}/${opts.modelId}。可尝试 /reload 后重试。`,
    };
  }
  const ok = await opts.pi.setModel(model);
  if (!ok) {
    return { ok: false, message: "无可用 API key，setModel 失败" };
  }
  if (opts.setAsDefault) opts.setDefault(opts.providerId, opts.modelId);
  return {
    ok: true,
    message: opts.setAsDefault
      ? `已切换并设为默认: ${opts.providerId}/${opts.modelId}`
      : `已切换（仅本次）: ${opts.providerId}/${opts.modelId}`,
  };
}

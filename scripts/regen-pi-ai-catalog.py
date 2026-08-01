#!/usr/bin/env python3
"""Regenerate src/generated/pi-ai-catalog.json from installed pi-ai provider data.

Usage:
  python3 scripts/regen-pi-ai-catalog.py \\
    [/path/to/pi-ai/dist/providers/data]

Default data dir: pi-coding-agent's nested @earendil-works/pi-ai.
"""
from __future__ import annotations

import json
import glob
import os
import sys
from collections import defaultdict

DEFAULT_DATA = (
    "/usr/local/lib/node_modules/@earendil-works/pi-coding-agent/"
    "node_modules/@earendil-works/pi-ai/dist/providers/data"
)

PRIORITY = [
    "moonshotai-cn", "moonshotai", "kimi-coding",
    "anthropic", "openai", "openai-codex", "xai", "google", "google-vertex",
    "deepseek", "zai", "zai-coding-cn", "minimax", "minimax-cn",
    "mistral", "groq", "cerebras", "together", "fireworks", "nvidia",
    "huggingface", "github-copilot", "azure-openai-responses",
    "amazon-bedrock", "cloudflare-ai-gateway", "cloudflare-workers-ai",
    "qwen-token-plan", "qwen-token-plan-cn", "xiaomi",
    "opencode", "opencode-go", "openrouter", "vercel-ai-gateway",
    "ant-ling",
]


def main() -> None:
    data_dir = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_DATA
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out_path = os.path.join(root, "src", "generated", "pi-ai-catalog.json")
    prio = {n: i for i, n in enumerate(PRIORITY)}
    candidates: dict[str, list] = defaultdict(list)

    for path in glob.glob(os.path.join(data_dir, "*.json")):
        file_stem = os.path.basename(path).replace(".json", "")
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        for api, models in data.items():
            if not isinstance(models, dict):
                continue
            for _mid, m in models.items():
                if not isinstance(m, dict) or "id" not in m:
                    continue
                full_id = m["id"]
                bare = full_id.split("/")[-1]
                bare2 = (
                    bare.split(".")[-1]
                    if any(
                        bare.startswith(p)
                        for p in (
                            "anthropic.",
                            "openai.",
                            "us.",
                            "eu.",
                            "global.",
                            "jp.",
                            "au.",
                            "zai.",
                        )
                    )
                    else bare
                )
                keys = {full_id.lower(), bare.lower()}
                if bare2.lower() != bare.lower():
                    keys.add(bare2.lower())
                entry = {
                    "id": full_id,
                    "contextWindow": m.get("contextWindow"),
                    "maxTokens": m.get("maxTokens"),
                    "reasoning": bool(m.get("reasoning", False)),
                    "thinkingLevelMap": m.get("thinkingLevelMap"),
                    "input": m.get("input"),
                    "source": file_stem,
                    "provider": m.get("provider") or file_stem,
                    "api": m.get("api") or api,
                }
                rank = prio.get(file_stem, 1000)
                for k in keys:
                    candidates[k].append((rank, entry))

    index: dict[str, dict] = {}
    for key, items in candidates.items():
        items.sort(key=lambda x: x[0])
        best = items[0][1]
        rec = {
            "contextWindow": best["contextWindow"],
            "maxTokens": best.get("maxTokens"),
            "reasoning": best["reasoning"],
            "source": best["source"],
            "canonicalId": best["id"],
        }
        if best.get("thinkingLevelMap") is not None:
            rec["thinkingLevelMap"] = best["thinkingLevelMap"]
        if best.get("input"):
            rec["input"] = best["input"]
        index[key] = rec

    out = {
        "version": 1,
        "generatedFrom": "pi-ai dist/providers/data",
        "modelCount": len(index),
        "models": index,
    }
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"wrote {out_path} models={len(index)}")


if __name__ == "__main__":
    main()

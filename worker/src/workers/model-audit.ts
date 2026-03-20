import { Worker } from "bullmq";
import * as fs from "fs";
import * as path from "path";
import { redis, auditQueue } from "../queues";
import { PLAN_MODELS } from "../lib/openclaw-config";
import { prisma } from "../lib/prisma";
import { connectSSH, execSSH } from "../lib/ssh";

const REDIS_LAST_SWAP_KEY = "instaclaw:last-model-swap";
const SWAP_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours
const SWAP_HOPS_THRESHOLD = 15; // must score 15+ points higher to trigger swap
const CONFIG_PATH = "/opt/openclaw/home/.openclaw/openclaw.json";

const OR_MODELS_URL = "https://openrouter.ai/api/v1/models";

// ---------------------------------------------------------------------------
// Known overrides for meta-routers whose IDs don't reveal capabilities
// ---------------------------------------------------------------------------

const KNOWN_PARAMS: Record<string, number> = {
  "openrouter/healer-alpha": 1000,
  "openrouter/hunter-alpha": 1000,
  "openrouter/free": 200,
};

const KNOWN_CAPS: Record<string, Partial<ModelCaps>> = {
  "openrouter/healer-alpha": { tools: true, vision: true, audioIn: true, reasoning: true, structuredOutput: true, jsonMode: true },
  "openrouter/hunter-alpha": { tools: true, vision: true, reasoning: true, structuredOutput: true, jsonMode: true },
  "openrouter/free":         { tools: true, vision: true, reasoning: true, structuredOutput: true, jsonMode: true },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ORModel {
  id: string;
  name: string;
  pricing: { prompt: string; completion: string };
  context_length: number;
  top_provider?: { is_moderated: boolean; max_completion_tokens?: number };
  architecture?: {
    modality: string;
    input_modalities: string[];
    output_modalities: string[];
  };
  supported_parameters?: string[];
}

/** Capability flags we track for each model */
interface ModelCaps {
  tools: boolean;
  vision: boolean;        // image input
  imageGen: boolean;       // image output
  audioIn: boolean;        // audio input (voice messages)
  audioOut: boolean;       // audio output (TTS)
  videoOut: boolean;       // video output
  reasoning: boolean;      // chain-of-thought / thinking
  structuredOutput: boolean;
  jsonMode: boolean;       // response_format support
}

interface ConfiguredModel {
  plan: string;
  role: string;
  id: string;
  found: boolean;
  inputPer1M: number;
  outputPer1M: number;
  context: number;
  maxCompletion: number;
  params: number;
  caps: ModelCaps;
  hops: number;
}

interface RankedModel {
  id: string;
  name: string;
  inputPer1M: number;
  outputPer1M: number;
  context: number;
  params: number;
  caps: ModelCaps;
  hops: number;
}

interface FreeModel {
  id: string;
  name: string;
  params: number;
  context: number;
  modality: string;
  caps: ModelCaps;
  hops: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toPer1M(perToken: string): number {
  return parseFloat(perToken) * 1_000_000;
}

function toORId(openclawModel: string, modelMap?: Map<string, ORModel>): string {
  if (modelMap) {
    if (modelMap.has(openclawModel)) return openclawModel;
    const stripped = openclawModel.replace(/^openrouter\//, "");
    if (modelMap.has(stripped)) return stripped;
    return stripped;
  }
  return openclawModel.replace(/^openrouter\//, "");
}

function parseParamCount(id: string, name: string): number {
  if (KNOWN_PARAMS[id]) return KNOWN_PARAMS[id];
  const text = `${id} ${name}`.toLowerCase();
  const moe = text.match(/(\d+)x(\d+)b/);
  if (moe) return parseInt(moe[1]) * parseInt(moe[2]);
  const matches = [...text.matchAll(/(\d+(?:\.\d+)?)b(?:\b|-)/g)];
  if (matches.length > 0) return Math.max(...matches.map((m) => parseFloat(m[1])));
  return 0;
}

function extractCaps(m: ORModel): ModelCaps {
  const known = KNOWN_CAPS[m.id];
  const sp = m.supported_parameters ?? [];
  const inMod = m.architecture?.input_modalities ?? [];
  const outMod = m.architecture?.output_modalities ?? [];
  const modality = m.architecture?.modality ?? "";

  return {
    tools:            known?.tools ?? sp.includes("tools"),
    vision:           known?.vision ?? (inMod.includes("image") || modality.includes("image->")),
    imageGen:         outMod.includes("image"),
    audioIn:          inMod.includes("audio"),
    audioOut:         outMod.includes("audio"),
    videoOut:         outMod.includes("video"),
    reasoning:        known?.reasoning ?? sp.includes("reasoning"),
    structuredOutput: known?.structuredOutput ?? sp.includes("structured_outputs"),
    jsonMode:         known?.jsonMode ?? sp.includes("response_format"),
  };
}

function isFreeModel(m: ORModel): boolean {
  return parseFloat(m.pricing.prompt) === 0 && parseFloat(m.pricing.completion) === 0;
}

async function fetchModels(): Promise<ORModel[]> {
  const res = await fetch(OR_MODELS_URL);
  if (!res.ok) throw new Error(`OpenRouter models API: ${res.status}`);
  const json = await res.json();
  return json.data;
}

function fmtParams(b: number): string {
  if (b <= 0) return "?";
  if (b >= 1000) return `~${(b / 1000).toFixed(0)}T`;
  return `${b}B`;
}

/**
 * InstaClaw Hops Score (0–99)
 * Weighted evaluation for Standard-tier model suitability.
 * Audio input NOT scored — OpenClaw transcribes voice messages upstream via Gemini.
 *
 * GATING FACTORS (67 pts max, ~65 at minimum passing thresholds):
 *   Cost:        14 pts — free is essential for Standard tier
 *   Tool use:    15 pts — required for integrations, exec, Composio
 *   Vision:      11 pts — users send photos, screenshots, documents
 *   Params:      12 pts — quality proxy, instruction-following
 *   Context:     11 pts — conversation length + tool call results
 *   Max output:   4 pts — long-form writing, reports, code
 *
 * DIFFERENTIATING FACTORS (32 pts max):
 *   Reasoning:   12 pts — chain-of-thought for complex tasks
 *   Video output: 8 pts — emerging capability, huge differentiator
 *   Audio output: 5 pts — TTS, voice responses
 *   Max output+:  2 pts — bonus for very large output windows
 *   Image gen:    3 pts — image creation output
 *   Unmoderated:  2 pts — fewer refused requests
 */
function hopsScore(opts: {
  inputPer1M: number;
  params: number;
  context: number;
  maxCompletion?: number;
  isModerated?: boolean;
  caps: ModelCaps;
}): number {
  const { inputPer1M, params, context, maxCompletion, isModerated, caps } = opts;
  let score = 0;

  // === GATING FACTORS (67 max, ~65 floor) ===

  // Cost (14 pts)
  if (inputPer1M === 0) score += 14;
  else if (inputPer1M < 0.05) score += 11;
  else if (inputPer1M < 0.10) score += 8;
  else if (inputPer1M < 0.50) score += 5;
  else if (inputPer1M < 1.0) score += 2;

  // Tool use (15 pts) — graduated by depth of support
  if (caps.tools && caps.structuredOutput && caps.jsonMode) score += 15;
  else if (caps.tools && (caps.structuredOutput || caps.jsonMode)) score += 14;
  else if (caps.tools) score += 13;

  // Vision (11 pts)
  if (caps.vision) score += 11;

  // Params (12 pts) — log scale
  if (params >= 1000) score += 12;
  else if (params >= 200) score += 11;
  else if (params >= 100) score += 10;
  else if (params >= 70) score += 9;
  else if (params >= 30) score += 8;
  else if (params >= 12) score += 5;
  else if (params >= 7) score += 3;
  else if (params > 0) score += 1;

  // Context (11 pts)
  if (context >= 500_000) score += 11;
  else if (context >= 256_000) score += 10;
  else if (context >= 128_000) score += 9;
  else if (context >= 64_000) score += 6;
  else if (context >= 32_000) score += 3;
  else if (context >= 8_000) score += 1;

  // Max output length (4 pts)
  const maxOut = maxCompletion ?? 0;
  if (maxOut >= 16_000) score += 4;
  else if (maxOut >= 8_000) score += 3;
  else if (maxOut >= 4_000) score += 1;

  // === DIFFERENTIATING FACTORS (32 max) ===

  // Reasoning (12 pts) — biggest quality differentiator
  if (caps.reasoning) score += 12;

  // Video output (8 pts)
  if (caps.videoOut) score += 8;

  // Audio output (5 pts)
  if (caps.audioOut) score += 5;

  // Max output bonus (2 pts) — reward very large output windows
  if (maxOut >= 32_000) score += 2;
  else if (maxOut >= 16_000) score += 1;

  // Image generation (3 pts)
  if (caps.imageGen) score += 3;

  // Unmoderated (2 pts)
  if (isModerated === false) score += 2;

  return Math.min(99, score);
}

function fmtCtx(n: number): string { return `${(n / 1000).toFixed(0)}k`; }

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

interface AuditResult {
  timestamp: string;
  totalModels: number;
  configured: ConfiguredModel[];
  cheapestPaid: RankedModel[];
  midTier: RankedModel[];
  freeMultimodal: FreeModel[];
  warnings: string[];
}

export async function runModelAudit(): Promise<AuditResult> {
  const models = await fetchModels();
  const modelMap = new Map(models.map((m) => [m.id, m]));
  const warnings: string[] = [];
  const configured: ConfiguredModel[] = [];

  // 1. Check configured models
  for (const [plan, config] of Object.entries(PLAN_MODELS)) {
    const check = (role: string, modelStr: string) => {
      const id = toORId(modelStr, modelMap);
      const m = modelMap.get(id);
      const caps = m ? extractCaps(m) : { tools: false, vision: false, imageGen: false, audio: false, reasoning: false, structuredOutput: false, jsonMode: false };
      const inp = m ? toPer1M(m.pricing.prompt) : 0;
      const ctx = m?.context_length ?? 0;
      const p = m ? parseParamCount(m.id, m.name) : 0;
      configured.push({
        plan, role, id,
        found: !!m,
        inputPer1M: inp,
        outputPer1M: m ? toPer1M(m.pricing.completion) : 0,
        context: ctx,
        maxCompletion: m?.top_provider?.max_completion_tokens ?? 0,
        params: p,
        caps,
        hops: m ? hopsScore({ inputPer1M: inp, params: p, context: ctx, maxCompletion: m.top_provider?.max_completion_tokens, isModerated: m.top_provider?.is_moderated, caps }) : 0,
      });
      if (!m) warnings.push(`${plan} ${role} "${id}" NOT FOUND on OpenRouter`);
    };
    check("primary", config.primary);
    config.fallbacks.forEach((fb, i) => check(`fallback #${i + 1}`, fb));
  }

  // Warn about missing critical capabilities on configured models
  for (const c of configured) {
    if (!c.found) continue;
    if (!c.caps.tools) warnings.push(`${c.plan} ${c.role} "${c.id}" — NO tool use support`);
    if (c.role === "primary" && !c.caps.vision) warnings.push(`${c.plan} ${c.role} "${c.id}" — no vision (image input)`);
  }

  // 2. Cheapest paid models
  const paid = models.filter(
    (m) => !m.id.endsWith(":free") && parseFloat(m.pricing.prompt) > 0 && m.context_length >= 8000
  );
  const toRanked = (m: ORModel): RankedModel => {
    const inp = toPer1M(m.pricing.prompt);
    const caps = extractCaps(m);
    const p = parseParamCount(m.id, m.name);
    return { id: m.id, name: m.name, inputPer1M: inp, outputPer1M: toPer1M(m.pricing.completion), context: m.context_length, params: p, caps, hops: hopsScore({ inputPer1M: inp, params: p, context: m.context_length, maxCompletion: m.top_provider?.max_completion_tokens, isModerated: m.top_provider?.is_moderated, caps }) };
  };

  const cheapestPaid: RankedModel[] = paid
    .map(toRanked)
    .sort((a, b) => a.inputPer1M - b.inputPer1M)
    .slice(0, 10);

  // 3. Mid-tier value models
  const midTier: RankedModel[] = paid
    .map(toRanked)
    .filter((m) => m.inputPer1M >= 0.1 && m.inputPer1M <= 1.0 && m.context >= 32000)
    .sort((a, b) => a.inputPer1M - b.inputPer1M)
    .slice(0, 10);

  // 4. Free multimodal models — sorted by Hops Score
  const freeMultimodal: FreeModel[] = models
    .filter((m) => isFreeModel(m) && (extractCaps(m).vision) && m.context_length >= 8000)
    .map((m) => {
      const caps = extractCaps(m);
      const p = parseParamCount(m.id, m.name);
      return {
        id: m.id, name: m.name, params: p,
        context: m.context_length,
        modality: m.architecture?.modality ?? "unknown",
        caps,
        hops: hopsScore({ inputPer1M: 0, params: p, context: m.context_length, maxCompletion: m.top_provider?.max_completion_tokens, isModerated: m.top_provider?.is_moderated, caps }),
      };
    })
    .sort((a, b) => b.hops - a.hops);

  // 5. Starter model health check — compare Hops Scores
  const currentStarterId = toORId(PLAN_MODELS.starter.primary, modelMap);
  const currentEntry = freeMultimodal.find((m) => m.id === currentStarterId);
  if (freeMultimodal.length > 0) {
    const best = freeMultimodal[0]; // highest hops score
    const currentHops = currentEntry?.hops ?? 0;

    if (!currentEntry) {
      warnings.push(`Starter primary "${currentStarterId}" not in free multimodal list — consider ${best.id} (Hops ${best.hops})`);
    } else if (best.id !== currentStarterId && best.hops > currentHops + 5) {
      // Only warn if meaningfully better (>5 pts difference)
      warnings.push(`Higher Hops Score available: ${best.id} (${best.hops}) vs current ${currentStarterId} (${currentHops})`);
    }
  }

  // 6. Fallback price check
  const currentFallbackId = toORId(PLAN_MODELS.starter.fallbacks[0], modelMap);
  const fb = modelMap.get(currentFallbackId);
  if (fb && cheapestPaid.length > 0) {
    const fbPrice = toPer1M(fb.pricing.prompt);
    const cheaper = cheapestPaid.filter((m) => m.inputPer1M < fbPrice * 0.5 && m.id !== currentFallbackId);
    if (cheaper.length > 0) {
      warnings.push(`Cheaper fallback alternatives (>50% savings vs ${currentFallbackId}): ${cheaper.slice(0, 3).map((a) => a.id).join(", ")}`);
    }
  }

  return {
    timestamp: new Date().toISOString(),
    totalModels: models.length,
    configured,
    cheapestPaid,
    midTier,
    freeMultimodal: freeMultimodal.slice(0, 15),
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Plain-text report (for pm2 logs / CLI)
// ---------------------------------------------------------------------------

function capsStr(c: ModelCaps): string {
  const flags: string[] = [];
  if (c.tools) flags.push("tools");
  if (c.vision) flags.push("vision");
  if (c.imageGen) flags.push("img-gen");
  if (c.audioIn) flags.push("audio-in");
  if (c.audioOut) flags.push("audio-out");
  if (c.videoOut) flags.push("video-out");
  if (c.reasoning) flags.push("reasoning");
  if (c.structuredOutput) flags.push("structured");
  if (c.jsonMode) flags.push("json");
  return flags.length > 0 ? `[${flags.join(", ")}]` : "[none]";
}

export function formatPlainText(r: AuditResult): string {
  const lines: string[] = [];
  lines.push(`=== OpenRouter Model Audit === (${r.totalModels} models)`);
  lines.push("");

  lines.push("--- Configured Models ---");
  for (const c of r.configured) {
    const price = c.found ? `$${c.inputPer1M.toFixed(2)}/$${c.outputPer1M.toFixed(2)}/M` : "NOT FOUND";
    lines.push(`  ${c.plan} ${c.role}: ${c.id} — ${price} Hops:${c.hops} ${c.found ? capsStr(c.caps) : ""}`);
  }
  lines.push("");

  lines.push("--- Top 10 Cheapest Paid (8k+ ctx) ---");
  for (const m of r.cheapestPaid) lines.push(`  Hops:${m.hops} $${m.inputPer1M.toFixed(3)}/$${m.outputPer1M.toFixed(3)} — ${m.id} (${fmtCtx(m.context)}) ${capsStr(m.caps)}`);
  lines.push("");

  lines.push("--- Mid-Tier Value ($0.10-$1.00/M, 32k+ ctx) ---");
  for (const m of r.midTier) lines.push(`  Hops:${m.hops} $${m.inputPer1M.toFixed(3)}/$${m.outputPer1M.toFixed(3)} — ${m.id} (${fmtCtx(m.context)}) ${capsStr(m.caps)}`);
  lines.push("");

  lines.push("--- Free Multimodal (vision, 8k+ ctx) — sorted by Hops Score ---");
  for (const m of r.freeMultimodal) lines.push(`  Hops:${m.hops} ${m.id} — ${fmtParams(m.params)}, ${fmtCtx(m.context)} ${capsStr(m.caps)}`);
  lines.push("");

  if (r.warnings.length > 0) {
    lines.push("--- WARNINGS ---");
    for (const w of r.warnings) lines.push(`  ⚠ ${w}`);
  } else {
    lines.push("✓ No warnings");
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// HTML report
// ---------------------------------------------------------------------------

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function capTags(c: ModelCaps): string {
  const yes = (label: string) => `<span class="tag tag-y">${label}</span>`;
  const no = (label: string) => `<span class="tag tag-n">${label}</span>`;
  return [
    c.tools ? yes("tools") : no("tools"),
    c.vision ? yes("vision") : "",
    c.imageGen ? yes("img-gen") : "",
    c.audio ? yes("audio") : "",
    c.reasoning ? yes("reason") : "",
    c.structuredOutput ? yes("struct") : "",
    c.jsonMode ? yes("json") : "",
  ].filter(Boolean).join(" ");
}

const CHECK = `<span class="cap-y">✓</span>`;
const CROSS = `<span class="cap-n">✗</span>`;

function capCols(c: ModelCaps): string {
  const other: string[] = [];
  if (c.imageGen) other.push("img-gen");
  if (c.audioOut) other.push("audio-out");
  if (c.videoOut) other.push("video-out");
  return [
    `<td class="cap">${c.tools ? CHECK : CROSS}</td>`,
    `<td class="cap">${c.vision ? CHECK : CROSS}</td>`,
    `<td class="cap">${c.audioIn ? CHECK : CROSS}</td>`,
    `<td class="cap">${c.reasoning ? CHECK : CROSS}</td>`,
    `<td class="cap">${c.structuredOutput ? CHECK : CROSS}</td>`,
    `<td class="cap">${c.jsonMode ? CHECK : CROSS}</td>`,
    `<td class="cap-other">${other.length > 0 ? other.join(", ") : ""}</td>`,
  ].join("");
}

const CAP_HEADERS = `<th class="cap">Tools</th><th class="cap">Vision</th><th class="cap">Audio In</th><th class="cap">Reason</th><th class="cap">Struct</th><th class="cap">JSON</th><th class="cap">Other</th>`;

function hopsBadge(score: number): string {
  const cls = score >= 80 ? "hops-hi" : score >= 50 ? "hops-md" : "hops-lo";
  return `<span class="hops ${cls}">${score}</span>`;
}

export function writeReportPage(result: AuditResult): string {
  const now = new Date();
  const slug = `${now.getFullYear().toString().slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-model-audit`;
  const reportsDir = path.join(__dirname, "..", "..", "reports");
  fs.mkdirSync(reportsDir, { recursive: true });

  const { configured, cheapestPaid, midTier, freeMultimodal, warnings } = result;

  const css = `
    :root { --bg: #0d1117; --card: #161b22; --border: #30363d; --text: #c9d1d9; --dim: #8b949e; --blue: #58a6ff; --green: #3fb950; --yellow: #d29922; --red: #f85149; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; background: var(--bg); color: var(--text); padding: 1.5rem; line-height: 1.5; max-width: 1300px; margin: 0 auto; }
    h1 { color: var(--blue); font-size: 1.5rem; margin-bottom: 0.25rem; }
    .meta { color: var(--dim); font-size: 0.8rem; margin-bottom: 1.5rem; }
    .meta b { color: var(--text); }
    h2 { color: var(--text); font-size: 1rem; font-weight: 600; margin: 1.5rem 0 0.5rem; padding-bottom: 0.4rem; border-bottom: 1px solid var(--border); }
    .warn-box { background: #1c1206; border: 1px solid var(--yellow); border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem; }
    .warn-box h2 { color: var(--yellow); margin: 0 0 0.5rem; border: none; padding: 0; font-size: 0.9rem; }
    .warn-box ul { list-style: none; padding: 0; }
    .warn-box li { color: var(--yellow); font-size: 0.85rem; padding: 0.2rem 0; font-family: ui-monospace, monospace; }
    .ok-box { background: #0d1a0d; border: 1px solid var(--green); border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 1.5rem; color: var(--green); font-weight: 600; font-size: 0.9rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.8rem; background: var(--card); border-radius: 8px; overflow: hidden; margin-bottom: 0.5rem; }
    th { text-align: left; padding: 0.5rem 0.6rem; color: var(--dim); font-weight: 600; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid var(--border); background: var(--bg); white-space: nowrap; vertical-align: bottom; }
    td { padding: 0.4rem 0.6rem; border-bottom: 1px solid var(--border); font-family: ui-monospace, monospace; font-size: 0.78rem; }
    tr:last-child td { border-bottom: none; }
    tr:hover { background: rgba(88,166,255,0.04); }
    .r { text-align: right; }
    .tag { display: inline-block; padding: 0.05rem 0.35rem; border-radius: 3px; font-size: 0.65rem; font-weight: 600; white-space: nowrap; margin: 1px; }
    .tag-y { background: #0d1a0d; color: var(--green); border: 1px solid #1a3a1a; }
    .tag-n { background: #2d0b0b; color: var(--red); border: 1px solid #3d1515; }
    .tag-miss { background: #2d0b0b; color: var(--red); border: 1px solid var(--red); }
    .tag-ok { background: #0d1a0d; color: var(--green); }
    .cur { background: rgba(88,166,255,0.08); }
    .cur td:first-child::before { content: "▸ "; color: var(--blue); font-weight: bold; }
    .legend { color: var(--dim); font-size: 0.73rem; margin: 0.25rem 0 1rem; }
    .footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--border); color: var(--dim); font-size: 0.75rem; }
    .hops { display: inline-block; min-width: 2.2rem; text-align: center; padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.75rem; font-weight: 700; font-family: ui-monospace, monospace; }
    .hops-hi { background: #0d1a0d; color: var(--green); border: 1px solid var(--green); }
    .hops-md { background: #1c1206; color: var(--yellow); border: 1px solid var(--yellow); }
    .hops-lo { background: #2d0b0b; color: var(--red); border: 1px solid var(--red); }
    .cap { text-align: center; width: 3.5rem; }
    .cap-y { color: var(--green); font-weight: 700; }
    .cap-n { color: #484f58; }
    .cap-other { font-size: 0.72rem; color: var(--dim); white-space: nowrap; }
  `;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>InstaClaw OpenRouter Model Audit — ${now.toISOString().slice(0, 10)}</title>
  <link rel="icon" href="https://instaclaw.bot/favicon.ico" type="image/x-icon">
  <style>${css}</style>
</head>
<body>
  <h1>InstaClaw OpenRouter Model Audit</h1>
  <div class="meta">${now.toISOString()} · <b>${result.totalModels}</b> models indexed</div>

${warnings.length > 0
  ? `  <div class="warn-box"><h2>⚠ ${warnings.length} Warning${warnings.length > 1 ? "s" : ""}</h2><ul>${warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul></div>`
  : `  <div class="ok-box">✓ All clear — no warnings</div>`}

  <h2>Configured Models</h2>
  <table>
    <tr><th>Hops<br>Score</th><th>Plan</th><th>Role</th><th>Model ID</th><th>Status</th><th class="r">In $/M</th><th class="r">Out $/M</th><th class="r">Ctx</th><th class="r">Max Out</th>${CAP_HEADERS}</tr>
${configured.map((c) => `    <tr>
      <td>${c.found ? hopsBadge(c.hops) : "—"}</td>
      <td>${esc(c.plan)}</td><td>${esc(c.role)}</td><td>${esc(c.id)}</td>
      <td>${c.found ? '<span class="tag tag-ok">OK</span>' : '<span class="tag tag-miss">MISSING</span>'}</td>
      <td class="r">${c.found ? "$" + c.inputPer1M.toFixed(2) : "—"}</td>
      <td class="r">${c.found ? "$" + c.outputPer1M.toFixed(2) : "—"}</td>
      <td class="r">${c.found ? fmtCtx(c.context) : "—"}</td>
      <td class="r">${c.maxCompletion ? fmtCtx(c.maxCompletion) : "—"}</td>
      ${c.found ? capCols(c.caps) : '<td colspan="7">—</td>'}
    </tr>`).join("\n")}
  </table>

  <h2>Free Multimodal Models</h2>
  <div class="legend">Ranked by InstaClaw Hops Score. Current starter highlighted.</div>
  <table>
    <tr><th>Hops<br>Score</th><th>#</th><th>Model ID</th><th>Params</th><th class="r">Context</th><th>Modality</th>${CAP_HEADERS}</tr>
${freeMultimodal.map((m, i) => {
    const isCurrent = m.id === toORId(PLAN_MODELS.starter.primary);
    return `    <tr${isCurrent ? ' class="cur"' : ""}>
      <td>${hopsBadge(m.hops)}</td>
      <td>${i + 1}</td><td>${esc(m.id)}</td><td>${fmtParams(m.params)}</td>
      <td class="r">${fmtCtx(m.context)}</td><td>${esc(m.modality)}</td>
      ${capCols(m.caps)}
    </tr>`;
  }).join("\n")}
  </table>

  <h2>Top 10 Cheapest Paid <span style="font-weight:normal;color:var(--dim)">(8k+ ctx)</span></h2>
  <table>
    <tr><th>Hops<br>Score</th><th>#</th><th>Model ID</th><th class="r">In $/M</th><th class="r">Out $/M</th><th class="r">Ctx</th>${CAP_HEADERS}</tr>
${cheapestPaid.map((m, i) => `    <tr>
      <td>${hopsBadge(m.hops)}</td>
      <td>${i + 1}</td><td>${esc(m.id)}</td>
      <td class="r">$${m.inputPer1M.toFixed(3)}</td><td class="r">$${m.outputPer1M.toFixed(3)}</td>
      <td class="r">${fmtCtx(m.context)}</td>${capCols(m.caps)}
    </tr>`).join("\n")}
  </table>

  <h2>Mid-Tier Value <span style="font-weight:normal;color:var(--dim)">($0.10–$1.00/M, 32k+ ctx)</span></h2>
  <table>
    <tr><th>Hops<br>Score</th><th>#</th><th>Model ID</th><th class="r">In $/M</th><th class="r">Out $/M</th><th class="r">Ctx</th>${CAP_HEADERS}</tr>
${midTier.map((m, i) => `    <tr>
      <td>${hopsBadge(m.hops)}</td>
      <td>${i + 1}</td><td>${esc(m.id)}</td>
      <td class="r">$${m.inputPer1M.toFixed(3)}</td><td class="r">$${m.outputPer1M.toFixed(3)}</td>
      <td class="r">${fmtCtx(m.context)}</td>${capCols(m.caps)}
    </tr>`).join("\n")}
  </table>

  <div class="footer">Generated by instaclaw-worker model audit · Daily at 06:00 UTC</div>
</body>
</html>`;

  fs.writeFileSync(path.join(reportsDir, `${slug}.html`), html);
  return slug;
}

// ---------------------------------------------------------------------------
// Telegram
// ---------------------------------------------------------------------------

async function notifyTelegram(message: string): Promise<void> {
  const token = process.env.ADMIN_TELEGRAM_BOT_TOKEN;
  const chatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML", disable_web_page_preview: true }),
    });
  } catch (err) {
    console.error("[model-audit] Failed to send Telegram notification:", err);
  }
}

// ---------------------------------------------------------------------------
// Auto-swap: verify model works via OpenRouter API
// ---------------------------------------------------------------------------

async function verifyModelWorks(modelId: string): Promise<boolean> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn("[auto-swap] No OPENROUTER_API_KEY set, skipping verification");
    return false;
  }
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: "Say hi" }],
        max_tokens: 10,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`[auto-swap] Verification failed for ${modelId}: HTTP ${res.status} — ${body.slice(0, 200)}`);
      return false;
    }
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      console.warn(`[auto-swap] Verification failed for ${modelId}: empty response`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[auto-swap] Verification failed for ${modelId}:`, err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Auto-swap: update instances with new model
// ---------------------------------------------------------------------------

async function updateInstanceModel(
  tailscaleIp: string,
  tag: string,
  newPrimary: string,
  newFallbacks: string[],
  forceRestart: boolean,
): Promise<boolean> {
  let ssh;
  try {
    ssh = await connectSSH(tailscaleIp);
  } catch (err) {
    console.error(`${tag} SSH connect failed, skipping:`, err);
    return false;
  }
  try {
    // Use python3 to read, update, and write the JSON config
    const fallbacksJson = JSON.stringify(newFallbacks);
    const pyScript = `
import json, sys
try:
    with open('${CONFIG_PATH}', 'r') as f:
        config = json.load(f)
except Exception as e:
    print(f"ERROR reading config: {e}", file=sys.stderr)
    sys.exit(1)

# Navigate to agents.defaults.model, creating if needed
agents = config.setdefault('agents', {})
defaults = agents.setdefault('defaults', {})
model = defaults.setdefault('model', {})
model['primary'] = '${newPrimary}'
model['fallbacks'] = json.loads('${fallbacksJson}')

with open('${CONFIG_PATH}', 'w') as f:
    json.dump(config, f, indent=2)
print('OK')
`.trim();
    const result = await execSSH(ssh, `python3 -c ${JSON.stringify(pyScript)}`, "/opt/openclaw");
    if (!result.includes("OK")) {
      console.error(`${tag} python3 config update did not return OK: ${result}`);
      return false;
    }

    if (forceRestart) {
      // Dead model — restart now, the bot is already broken
      await execSSH(ssh, "docker compose restart", "/opt/openclaw");
      console.log(`${tag} Config updated + container restarted`);
    } else {
      // Better model — config written, takes effect on next session
      console.log(`${tag} Config updated (no restart — takes effect next session)`);
    }
    return true;
  } catch (err) {
    console.error(`${tag} Failed to update model:`, err);
    return false;
  } finally {
    ssh.dispose();
  }
}

// ---------------------------------------------------------------------------
// Auto-swap: main logic
// ---------------------------------------------------------------------------

export async function autoSwapModels(): Promise<void> {
  const models = await fetchModels();
  const modelMap = new Map(models.map((m) => [m.id, m]));

  // Current standard/starter primary (they share the same config)
  const currentModelStr = PLAN_MODELS.standard.primary;
  const currentORId = toORId(currentModelStr, modelMap);
  const currentModel = modelMap.get(currentORId);
  const currentGone = !currentModel;

  // Hard requirements: free + tools + vision + 65k+ context + 30B+ params
  const candidates = models
    .filter((m) => {
      if (!isFreeModel(m)) return false;
      const caps = extractCaps(m);
      if (!caps.tools || !caps.vision) return false;
      if (m.context_length < 65_000) return false;
      const params = parseParamCount(m.id, m.name);
      if (params < 30) return false;
      return true;
    })
    .map((m) => {
      const caps = extractCaps(m);
      const params = parseParamCount(m.id, m.name);
      return {
        id: m.id,
        name: m.name,
        params,
        context: m.context_length,
        caps,
        hops: hopsScore({ inputPer1M: 0, params, context: m.context_length, maxCompletion: m.top_provider?.max_completion_tokens, isModerated: m.top_provider?.is_moderated, caps }),
      };
    })
    .sort((a, b) => b.hops - a.hops);

  if (candidates.length === 0) {
    console.warn("[auto-swap] No candidates meet hard requirements, skipping");
    return;
  }

  const best = candidates[0];

  // Score the current model (if it still exists)
  let currentHops = 0;
  if (currentModel) {
    const caps = extractCaps(currentModel);
    const params = parseParamCount(currentModel.id, currentModel.name);
    currentHops = hopsScore({ inputPer1M: 0, params, context: currentModel.context_length, maxCompletion: currentModel.top_provider?.max_completion_tokens, isModerated: currentModel.top_provider?.is_moderated, caps });
  }

  // Determine if swap is needed
  const scoreDelta = best.hops - currentHops;
  const bestIsDifferent = best.id !== currentORId;
  const shouldSwap = currentGone || (bestIsDifferent && scoreDelta >= SWAP_HOPS_THRESHOLD);

  if (!shouldSwap) return; // No swap needed — stay quiet

  // Anti-flap: check cooldown (skip cooldown if current model is gone)
  if (!currentGone) {
    const lastSwapStr = await redis.get(REDIS_LAST_SWAP_KEY);
    if (lastSwapStr) {
      const elapsed = Date.now() - parseInt(lastSwapStr, 10);
      if (elapsed < SWAP_COOLDOWN_MS) {
        console.log(`[auto-swap] Cooldown active (${Math.round((SWAP_COOLDOWN_MS - elapsed) / 60000)}min remaining), skipping`);
        return;
      }
    }
  }

  const reason = currentGone
    ? `current model GONE from OpenRouter`
    : `better candidate (+${scoreDelta} Hops)`;
  console.log(`[auto-swap] Swap triggered: ${reason}`);
  console.log(`[auto-swap] ${currentORId} (Hops ${currentHops}) -> ${best.id} (Hops ${best.hops})`);

  // Verify the new model actually works
  const verified = await verifyModelWorks(best.id);
  if (!verified) {
    console.warn(`[auto-swap] New model ${best.id} failed verification, aborting swap`);
    await notifyTelegram(
      `<b>⚠ Auto-Swap Aborted</b>\n\nModel <code>${best.id}</code> failed verification test.\nReason: ${reason}\nCurrent: <code>${currentORId}</code>`
    );
    return;
  }

  // Pick top 2 remaining free models with tools as fallbacks
  const fallbackCandidates = candidates
    .filter((c) => c.id !== best.id && c.caps.tools)
    .slice(0, 2);
  const newFallbacks = fallbackCandidates.map((c) => `openrouter/${c.id}`);
  const newPrimary = `openrouter/${best.id}`;

  // Fetch all active starter/standard instances
  const instances = await prisma.instance.findMany({
    where: {
      status: "active",
      tailscaleIp: { not: null },
      user: {
        subscription: {
          plan: { in: ["starter", "standard"] },
        },
      },
    },
    select: {
      id: true,
      tailscaleIp: true,
    },
  });

  const swapMode = currentGone ? "restart" : "config-only";
  console.log(`[auto-swap] Updating ${instances.length} instance(s) (${swapMode})...`);
  let updated = 0;
  let failed = 0;

  for (const inst of instances) {
    const tag = `[auto-swap:${inst.id.slice(0, 8)}]`;
    const ok = await updateInstanceModel(inst.tailscaleIp!, tag, newPrimary, newFallbacks, currentGone);
    if (ok) {
      updated++;
    } else {
      failed++;
    }
  }

  // Set cooldown
  await redis.set(REDIS_LAST_SWAP_KEY, Date.now().toString());

  const fallbackStr = newFallbacks.length > 0
    ? `\nFallbacks: ${newFallbacks.map((f) => `<code>${f}</code>`).join(", ")}`
    : "";

  // Announce to users on updated instances via cron announce
  const modelDisplayName = best.name || best.id.split("/").pop() || best.id;
  const announceMsg = `InstaClaw HOPS has upgraded you to ${modelDisplayName}.`;
  for (const inst of instances) {
    try {
      const ssh = await connectSSH(inst.tailscaleIp!);
      try {
        const now = new Date();
        const announceMin = (now.getUTCMinutes() + 2) % 60;
        const announceHour = now.getUTCMinutes() >= 58 ? (now.getUTCHours() + 1) % 24 : now.getUTCHours();
        const announceJob = {
          version: 1,
          jobs: [{
            id: `hops-announce-${Date.now()}`,
            description: "HOPS model upgrade announcement",
            schedule: { cron: `${announceMin} ${announceHour} * * *` },
            prompt: announceMsg,
            sessionTarget: "isolated",
            delivery: { mode: "announce" },
            oneShot: true,
          }],
        };
        await execSSH(ssh, `cat > /opt/openclaw/home/.openclaw/cron/hops-announce.json << 'CRONEOF'\n${JSON.stringify(announceJob, null, 2)}\nCRONEOF`);
      } finally {
        ssh.dispose();
      }
    } catch {
      // Non-blocking — announcement is best-effort
    }
  }

  console.log(`[auto-swap] Done: ${updated} updated, ${failed} failed (${swapMode})`);
  await notifyTelegram(
    `<b>🔄 Auto-Swap Complete</b>\n\n` +
    `<code>${currentORId}</code> (Hops ${currentHops})\n→ <code>${best.id}</code> (Hops ${best.hops})${fallbackStr}\n\n` +
    `Reason: ${reason}\nMode: ${swapMode}\nInstances: ${updated} updated, ${failed} failed`
  );
}

// ---------------------------------------------------------------------------
// BullMQ worker
// ---------------------------------------------------------------------------

export const modelAuditWorker = new Worker(
  "audit",
  async (job) => {
    const isDailyRun = new Date().getUTCHours() === 6;

    try {
      // Auto-swap runs every 15 minutes
      await autoSwapModels();
    } catch (err) {
      console.error(`[model-watch:${job.id}] Auto-swap error:`, err);
      // Don't throw — let the daily audit still run if applicable
    }

    // Full audit report only on the daily 06:00 UTC run
    if (isDailyRun) {
      console.log(`[model-watch:${job.id}] Running daily model audit report...`);
      try {
        const result = await runModelAudit();
        const text = formatPlainText(result);
        for (const line of text.split("\n")) console.log(`[model-watch:${job.id}] ${line}`);

        const slug = writeReportPage(result);
        const url = `https://worker.instaclaw.bot/reports/${slug}`;

        const summary = result.warnings.length > 0
          ? `\n\n<b>⚠ ${result.warnings.length} warning(s)</b>\n${result.warnings.join("\n")}`
          : "\n\n✓ No warnings";
        await notifyTelegram(`<b>📊 Model Audit Complete</b>${summary}\n\n<a href="${url}">Full Report →</a>`);
      } catch (error) {
        console.error(`[model-watch:${job.id}] Audit report failed:`, error);
        await notifyTelegram(`<b>❌ Model Audit Failed</b>\n\n${error}`);
        throw error;
      }
    }
  },
  { connection: redis, concurrency: 1 }
);

modelAuditWorker.on("failed", (job, err) => {
  console.error(`Model watch job ${job?.id} failed:`, err.message);
});

export async function scheduleModelWatch() {
  const repeatableJobs = await auditQueue.getRepeatableJobs();
  for (const job of repeatableJobs) await auditQueue.removeRepeatableByKey(job.key);
  await auditQueue.add("model-watch", {}, { repeat: { pattern: "*/15 * * * *" } });
  console.log("Model watch scheduled (every 15 minutes)");
}

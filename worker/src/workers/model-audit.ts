import { Worker } from "bullmq";
import * as fs from "fs";
import * as path from "path";
import { redis, auditQueue } from "../queues";
import { PLAN_MODELS } from "../lib/openclaw-config";

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
  "openrouter/healer-alpha": { tools: true, vision: true, reasoning: true, structuredOutput: true, jsonMode: true },
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
  audio: boolean;          // audio input or output
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
    audio:            inMod.includes("audio") || outMod.includes("audio"),
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
 * InstaClaw Hops Score (1–100)
 * Weighted evaluation for starter-tier suitability.
 *
 * Cost:        30 pts — free is king for starter
 * Tool use:    25 pts — required for agent features
 * Vision:      15 pts — multimodal input
 * Params:      15 pts — model quality proxy
 * Context:      5 pts — starters won't hit limits
 * Reasoning:    5 pts — chain-of-thought
 * Structured:   3 pts — structured output / JSON mode
 * Audio/video:  2 pts — bonus for omni-modal
 */
function hopsScore(opts: {
  inputPer1M: number;
  params: number;
  context: number;
  caps: ModelCaps;
}): number {
  const { inputPer1M, params, context, caps } = opts;
  let score = 0;

  // Cost (30 pts) — free=30, <$0.05=25, <$0.10=20, <$0.50=15, <$1=10, <$3=5, else 0
  if (inputPer1M === 0) score += 30;
  else if (inputPer1M < 0.05) score += 25;
  else if (inputPer1M < 0.10) score += 20;
  else if (inputPer1M < 0.50) score += 15;
  else if (inputPer1M < 1.0) score += 10;
  else if (inputPer1M < 3.0) score += 5;

  // Tool use (25 pts) — binary
  if (caps.tools) score += 25;

  // Vision (15 pts) — binary
  if (caps.vision) score += 15;

  // Params (15 pts) — log scale: 1T+=15, 200B=13, 70B=11, 30B=9, 12B=7, 7B=5, 3B=3, <1B=1, unknown=0
  if (params >= 1000) score += 15;
  else if (params >= 200) score += 13;
  else if (params >= 70) score += 11;
  else if (params >= 30) score += 9;
  else if (params >= 12) score += 7;
  else if (params >= 7) score += 5;
  else if (params >= 3) score += 3;
  else if (params > 0) score += 1;
  // params === 0 (unknown) → 0 pts

  // Context (5 pts) — scaled
  if (context >= 500_000) score += 5;
  else if (context >= 128_000) score += 4;
  else if (context >= 64_000) score += 3;
  else if (context >= 32_000) score += 2;
  else if (context >= 8_000) score += 1;

  // Reasoning (5 pts)
  if (caps.reasoning) score += 5;

  // Structured output (3 pts) — structured_outputs or response_format
  if (caps.structuredOutput || caps.jsonMode) score += 3;

  // Audio/video (2 pts)
  if (caps.audio) score += 2;

  return Math.min(100, score);
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
        hops: m ? hopsScore({ inputPer1M: inp, params: p, context: ctx, caps }) : 0,
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
    return { id: m.id, name: m.name, inputPer1M: inp, outputPer1M: toPer1M(m.pricing.completion), context: m.context_length, params: p, caps, hops: hopsScore({ inputPer1M: inp, params: p, context: m.context_length, caps }) };
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
        hops: hopsScore({ inputPer1M: 0, params: p, context: m.context_length, caps }),
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
  if (c.audio) flags.push("audio");
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
    th { text-align: left; padding: 0.5rem 0.6rem; color: var(--dim); font-weight: 600; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid var(--border); background: var(--bg); white-space: nowrap; }
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
  `;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Model Audit — ${now.toISOString().slice(0, 10)}</title>
  <style>${css}</style>
</head>
<body>
  <h1>OpenRouter Model Audit</h1>
  <div class="meta">${now.toISOString()} · <b>${result.totalModels}</b> models indexed</div>

${warnings.length > 0
  ? `  <div class="warn-box"><h2>⚠ ${warnings.length} Warning${warnings.length > 1 ? "s" : ""}</h2><ul>${warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul></div>`
  : `  <div class="ok-box">✓ All clear — no warnings</div>`}

  <h2>Configured Models</h2>
  <table>
    <tr><th>Hops</th><th>Plan</th><th>Role</th><th>Model ID</th><th>Status</th><th class="r">In $/M</th><th class="r">Out $/M</th><th class="r">Ctx</th><th class="r">Max Out</th><th>Capabilities</th></tr>
${configured.map((c) => `    <tr>
      <td>${c.found ? hopsBadge(c.hops) : "—"}</td>
      <td>${esc(c.plan)}</td><td>${esc(c.role)}</td><td>${esc(c.id)}</td>
      <td>${c.found ? '<span class="tag tag-ok">OK</span>' : '<span class="tag tag-miss">MISSING</span>'}</td>
      <td class="r">${c.found ? "$" + c.inputPer1M.toFixed(2) : "—"}</td>
      <td class="r">${c.found ? "$" + c.outputPer1M.toFixed(2) : "—"}</td>
      <td class="r">${c.found ? fmtCtx(c.context) : "—"}</td>
      <td class="r">${c.maxCompletion ? fmtCtx(c.maxCompletion) : "—"}</td>
      <td>${c.found ? capTags(c.caps) : "—"}</td>
    </tr>`).join("\n")}
  </table>

  <h2>Free Multimodal Models</h2>
  <div class="legend">Ranked by InstaClaw Hops Score. Current starter highlighted.</div>
  <table>
    <tr><th>Hops</th><th>#</th><th>Model ID</th><th>Params</th><th class="r">Context</th><th>Modality</th><th>Capabilities</th></tr>
${freeMultimodal.map((m, i) => {
    const isCurrent = m.id === toORId(PLAN_MODELS.starter.primary);
    return `    <tr${isCurrent ? ' class="cur"' : ""}>
      <td>${hopsBadge(m.hops)}</td>
      <td>${i + 1}</td><td>${esc(m.id)}</td><td>${fmtParams(m.params)}</td>
      <td class="r">${fmtCtx(m.context)}</td><td>${esc(m.modality)}</td>
      <td>${capTags(m.caps)}</td>
    </tr>`;
  }).join("\n")}
  </table>

  <h2>Top 10 Cheapest Paid <span style="font-weight:normal;color:var(--dim)">(8k+ ctx)</span></h2>
  <table>
    <tr><th>Hops</th><th>#</th><th>Model ID</th><th class="r">In $/M</th><th class="r">Out $/M</th><th class="r">Ctx</th><th>Capabilities</th></tr>
${cheapestPaid.map((m, i) => `    <tr>
      <td>${hopsBadge(m.hops)}</td>
      <td>${i + 1}</td><td>${esc(m.id)}</td>
      <td class="r">$${m.inputPer1M.toFixed(3)}</td><td class="r">$${m.outputPer1M.toFixed(3)}</td>
      <td class="r">${fmtCtx(m.context)}</td><td>${capTags(m.caps)}</td>
    </tr>`).join("\n")}
  </table>

  <h2>Mid-Tier Value <span style="font-weight:normal;color:var(--dim)">($0.10–$1.00/M, 32k+ ctx)</span></h2>
  <table>
    <tr><th>Hops</th><th>#</th><th>Model ID</th><th class="r">In $/M</th><th class="r">Out $/M</th><th class="r">Ctx</th><th>Capabilities</th></tr>
${midTier.map((m, i) => `    <tr>
      <td>${hopsBadge(m.hops)}</td>
      <td>${i + 1}</td><td>${esc(m.id)}</td>
      <td class="r">$${m.inputPer1M.toFixed(3)}</td><td class="r">$${m.outputPer1M.toFixed(3)}</td>
      <td class="r">${fmtCtx(m.context)}</td><td>${capTags(m.caps)}</td>
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
// BullMQ worker
// ---------------------------------------------------------------------------

export const modelAuditWorker = new Worker(
  "audit",
  async (job) => {
    console.log(`[model-audit:${job.id}] Running daily model audit...`);
    try {
      const result = await runModelAudit();
      const text = formatPlainText(result);
      for (const line of text.split("\n")) console.log(`[model-audit:${job.id}] ${line}`);

      const slug = writeReportPage(result);
      const url = `https://worker.instaclaw.bot/reports/${slug}`;

      const summary = result.warnings.length > 0
        ? `\n\n<b>⚠ ${result.warnings.length} warning(s)</b>\n${result.warnings.join("\n")}`
        : "\n\n✓ No warnings";
      await notifyTelegram(`<b>📊 Model Audit Complete</b>${summary}\n\n<a href="${url}">Full Report →</a>`);
    } catch (error) {
      console.error(`[model-audit:${job.id}] Failed:`, error);
      await notifyTelegram(`<b>❌ Model Audit Failed</b>\n\n${error}`);
      throw error;
    }
  },
  { connection: redis, concurrency: 1 }
);

modelAuditWorker.on("failed", (job, err) => {
  console.error(`Model audit job ${job?.id} failed:`, err.message);
});

export async function scheduleModelAudit() {
  const repeatableJobs = await auditQueue.getRepeatableJobs();
  for (const job of repeatableJobs) await auditQueue.removeRepeatableByKey(job.key);
  await auditQueue.add("model-audit", {}, { repeat: { pattern: "0 6 * * *" } });
  console.log("Model audit scheduled (daily at 06:00 UTC)");
}

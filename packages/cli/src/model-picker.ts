import { emitKeypressEvents } from "node:readline";
import { MODELS, getModelConfig, type ModelId, type ReasoningLevel } from "../../agent-runtime/src/models/config.js";
import { MODEL_PRICING } from "../../agent-runtime/src/models/pricing.js";

export interface ModelChoice { modelId: ModelId; reasoningLevel?: ReasoningLevel }
interface Key { name?: string; ctrl?: boolean; meta?: boolean }

const color = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: string, value: string) => color ? `\u001b[${code}m${value}\u001b[0m` : value;
const cyan = (value: string) => paint("38;2;76;183;210", value);
const mint = (value: string) => paint("38;2;113;240;194", value);
const amber = (value: string) => paint("38;2;255;210;95", value);
const muted = (value: string) => paint("38;2;185;206;218", value);

const ids = Object.keys(MODELS) as ModelId[];
const providerKey: Record<string, readonly string[]> = {
  openai: ["OPENAI_API_KEY"], anthropic: ["ANTHROPIC_API_KEY"], google: ["GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"],
};

export function matchingModels(query: string): ModelId[] {
  const needle = query.trim().toLowerCase();
  return ids.filter((id) => id.includes(needle) || MODELS[id].provider.includes(needle));
}

function fit(value: string, width: number): string {
  return value.length > width ? `${value.slice(0, width - 1)}…` : value.padEnd(width);
}

export function modelPickerLines(query: string, selected: number, current: ModelId, reasoning: ReasoningLevel | undefined, columns = 100): string[] {
  const matched = matchingModels(query);
  const compact = columns < 74;
  const lines = ["", cyan("  TOURIST  /  CHOOSE A MODEL"), muted("  ↑↓ move   Enter select   type to filter   ←→ reasoning   Esc cancel"), `  Search: ${query || muted("all models")}`, ""];
  lines.push(muted(compact ? "  Model                   Provider    $ input / output" : "  Model                   Provider    $ input / out    API key     Reasoning"));
  if (!matched.length) lines.push(amber("  No matching models. Backspace to widen the search."));
  for (const [index, id] of matched.entries()) {
    const config = MODELS[id];
    const rate = MODEL_PRICING[id];
    const hasKey = providerKey[config.provider]?.some((name) => Boolean(process.env[name]));
    const price = `$${rate.input} / $${rate.output}`;
    const level = getModelConfig(id).options.reasoningLevels ? reasoning ?? "auto" : "—";
    const row = `  ${index === selected ? "›" : " "} ${fit(id, 23)} ${fit(config.provider, 10)} ${fit(price, 16)}${compact ? "" : ` ${fit(hasKey ? "ready" : "key needed", 10)} ${level}`}`;
    lines.push(index === selected ? amber(row) : id === current ? mint(row) : muted(row));
  }
  lines.push("", muted(`  Current: ${current}    ${compact ? "" : "Reasoning: auto / low / medium / high"}`), "");
  return lines;
}

export async function selectModel(current: ModelChoice): Promise<ModelChoice | undefined> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("Model picker requires a TTY");
  emitKeypressEvents(process.stdin);
  const wasRaw = process.stdin.isRaw;
  process.stdin.setRawMode(true);
  process.stdin.resume();
  let query = "";
  let selected = Math.max(0, ids.indexOf(current.modelId));
  let reasoning = current.reasoningLevel;
  let rows = 0;
  const draw = () => {
    const lines = modelPickerLines(query, selected, current.modelId, reasoning, process.stdout.columns ?? 100);
    if (rows) process.stdout.write(`\r\u001b[${rows - 1}A\u001b[J`);
    process.stdout.write(lines.join("\n"));
    rows = lines.length;
  };
  draw();
  return new Promise((resolve) => {
    const finish = (choice?: ModelChoice) => {
      process.stdin.off("keypress", onKey);
      process.stdout.off("resize", draw);
      process.stdin.setRawMode(Boolean(wasRaw));
      process.stdin.pause();
      process.stdout.write("\n");
      resolve(choice);
    };
    const onKey = (character: string, key: Key) => {
      const matched = matchingModels(query);
      const id = matched[selected];
      if (key.name === "escape" || (key.ctrl && key.name === "c")) { finish(); return; }
      if (key.name === "return" || key.name === "enter") {
        if (id) finish({ modelId: id, ...(getModelConfig(id).options.reasoningLevels && reasoning ? { reasoningLevel: reasoning } : {}) });
        return;
      }
      if (key.name === "up" || key.name === "down") { if (matched.length) selected = (selected + (key.name === "down" ? 1 : -1) + matched.length) % matched.length; draw(); return; }
      if (key.name === "left" || key.name === "right") {
        const levels = id ? getModelConfig(id).options.reasoningLevels : undefined;
        if (levels) {
          const values: Array<ReasoningLevel | undefined> = [undefined, ...levels];
          const index = values.indexOf(reasoning);
          reasoning = values[(index + (key.name === "right" ? 1 : -1) + values.length) % values.length];
          draw();
        }
        return;
      }
      if (key.name === "backspace") { query = query.slice(0, -1); selected = 0; draw(); return; }
      if (!key.ctrl && !key.meta && character && /^[a-z0-9-]$/i.test(character)) { query += character.toLowerCase(); selected = 0; draw(); }
    };
    process.stdin.on("keypress", onKey);
    process.stdout.on("resize", draw);
  });
}

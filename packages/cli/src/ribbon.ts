import { emitKeypressEvents } from "node:readline";
import { renderPrompt } from "./terminal.js";
import type { RunOptions } from "./options.js";

interface Command { name: string; description: string; takesArgument?: boolean }

export const COMMANDS: readonly Command[] = [
  { name: "/run", description: "Edit, test, commit", takesArgument: true },
  { name: "/plan", description: "Plan without edits", takesArgument: true },
  { name: "/ask", description: "Explore and explain", takesArgument: true },
  { name: "/debug", description: "Reproduce and fix", takesArgument: true },
  { name: "/multi-task", description: "Run tasks from JSON", takesArgument: true },
  { name: "/model", description: "Choose model", takesArgument: true },
  { name: "/models", description: "Model prices" },
  { name: "/repo", description: "Change repository", takesArgument: true },
  { name: "/cloud", description: "Use cloud API", takesArgument: true },
  { name: "/local", description: "Use this laptop" },
  { name: "/memory", description: "Scoped notes" },
  { name: "/status", description: "Cloud run status", takesArgument: true },
  { name: "/help", description: "All commands" },
  { name: "/exit", description: "Leave Tourist" },
];

const color = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: string, value: string) => color ? `\u001b[${code}m${value}\u001b[0m` : value;
const cyan = (value: string) => paint("38;2;76;183;210", value);
const mint = (value: string) => paint("38;2;113;240;194", value);
const amber = (value: string) => paint("38;2;255;210;95", value);
const muted = (value: string) => paint("38;2;185;206;218", value);

function candidates(buffer: string): Command[] {
  if (!buffer || buffer.includes(" ")) return [];
  if (buffer.startsWith("/")) return COMMANDS.filter((command) => command.name.startsWith(buffer.toLowerCase()));
  if (!/^[a-z-]{1,20}$/i.test(buffer)) return [];
  const query = buffer.toLowerCase();
  const prefix = COMMANDS.filter((command) => command.name.slice(1).startsWith(query));
  if (prefix.length) return prefix;
  const sequential = (name: string) => {
    let offset = 0;
    for (const letter of name) if (letter === query[offset]) offset++;
    return offset === query.length;
  };
  return COMMANDS.filter((command) => sequential(command.name.slice(1)));
}

function completion(buffer: string, command?: Command): string {
  if (!command) return "";
  const name = buffer.startsWith("/") ? command.name : command.name.slice(1);
  return name.toLowerCase().startsWith(buffer.toLowerCase()) ? name.slice(buffer.length) : "";
}

function pad(value: string, width: number): string {
  return value.length > width ? `${value.slice(0, width - 1)}…` : value.padEnd(width);
}

function frame(edge: "top" | "bottom", label: string, width: number): string {
  const prefix = edge === "top" ? "╭─ " : "╰─ ";
  const suffix = edge === "top" ? "╮" : "╯";
  const shown = pad(label, Math.max(1, width - prefix.length - suffix.length - 1)).trimEnd();
  return cyan(`${prefix}${shown} ${"─".repeat(Math.max(0, width - prefix.length - shown.length - suffix.length - 1))}${suffix}`);
}

/** Lines are kept below terminal width so the redraw never relies on line wrapping. */
export function ribbonLines(buffer: string, selected: number, columns = 80): string[] {
  const width = Math.max(24, columns - 1);
  const matches = candidates(buffer);
  const open = Boolean(matches.length) || (buffer.startsWith("/") && !buffer.includes(" "));
  const top = frame("top", open ? buffer.startsWith("/") ? "COMMANDS" : "SUGGESTIONS" : "TOURIST / COMMANDS", width);
  if (!open) {
    const summary = "RUN  PLAN  ASK  DEBUG   │   MODEL  REPO  CLOUD  MEMORY  MORE /";
    return [top, `│ ${mint(pad(summary, width - 4))} │`, frame("bottom", "Type / or a command · Tab to complete", width)];
  }
  const cells = columns >= 110 ? 3 : columns >= 76 ? 2 : 1;
  const cellWidth = Math.floor((width - 4) / cells);
  const rows: string[] = [top];
  if (!matches.length) rows.push(`│ ${muted(pad("No matching command. Backspace to see all options.", width - 4))} │`);
  for (let offset = 0; offset < matches.length; offset += cells) {
    const parts = matches.slice(offset, offset + cells).map((command, index) => {
      const active = offset + index === selected;
      const label = pad(`${active ? "›" : " "} ${command.name}`, 15);
      const detail = pad(command.description, Math.max(6, cellWidth - 16));
      return (active ? amber(label) : mint(label)) + muted(detail);
    });
    while (parts.length < cells) parts.push(" ".repeat(cellWidth));
    rows.push(`│ ${parts.join("")} │`);
  }
  rows.push(frame("bottom", buffer.startsWith("/") ? "↑↓ choose · Tab complete · Enter select" : "↑↓ choose · Tab complete · Enter sends task", width));
  return rows;
}

interface Key { name?: string; ctrl?: boolean; meta?: boolean; sequence?: string }

/** A one-line editor with a redrawable command ribbon above the prompt. */
export async function readRibbonCommand(mode: RunOptions["mode"], history: readonly string[]): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("Interactive terminal requires a TTY");
  emitKeypressEvents(process.stdin);
  const wasRaw = process.stdin.isRaw;
  process.stdin.setRawMode(true);
  process.stdin.resume();
  let buffer = "";
  let cursor = 0;
  let selected = 0;
  let selectedByArrow = false;
  let historyIndex = history.length;
  let rowsDrawn = 0;
  const draw = () => {
    const columns = process.stdout.columns ?? 80;
    const prompt = renderPrompt(mode);
    const available = Math.max(8, columns - (`tourist ${mode} ❯ `.length) - 2);
    const start = Math.max(0, Math.min(cursor, buffer.length - available));
    const visible = buffer.slice(start, start + available);
    const matches = candidates(buffer);
    const ghost = cursor === buffer.length ? completion(buffer, matches[Math.min(selected, matches.length - 1)])?.slice(0, Math.max(0, available - visible.length)) : "";
    const lines = [...ribbonLines(buffer, selected, columns), `${prompt}${visible}${muted(ghost ?? "")}`];
    if (rowsDrawn) process.stdout.write(`\r\u001b[${rowsDrawn - 1}A\u001b[J`);
    process.stdout.write(lines.join("\n"));
    const moveLeft = visible.length + (ghost?.length ?? 0) - (cursor - start);
    if (moveLeft > 0) process.stdout.write(`\u001b[${moveLeft}D`);
    rowsDrawn = lines.length;
  };
  draw();
  return new Promise<string>((resolve) => {
    const finish = (line: string) => {
      process.stdin.off("keypress", onKey);
      process.stdout.off("resize", draw);
      process.stdin.setRawMode(Boolean(wasRaw));
      process.stdin.pause();
      process.stdout.write("\n");
      resolve(line.trim());
    };
    const onKey = (character: string, key: Key) => {
      const matches = candidates(buffer);
      if (key.ctrl && key.name === "c") { if (buffer) { buffer = ""; cursor = 0; selected = 0; selectedByArrow = false; draw(); } else finish("/exit"); return; }
      if (key.name === "return" || key.name === "enter") {
        if (matches.length && (buffer.startsWith("/") || selectedByArrow) && !buffer.includes(" ")) finish(matches[Math.min(selected, matches.length - 1)]?.name ?? buffer);
        else finish(buffer);
        return;
      }
      if (key.name === "tab") {
        if (matches.length) {
          const match = matches[Math.min(selected, matches.length - 1)];
          if (match) { buffer = match.name + (match.takesArgument ? " " : ""); cursor = buffer.length; selected = 0; selectedByArrow = false; draw(); }
        }
        return;
      }
      if (key.name === "escape") { buffer = ""; cursor = 0; selected = 0; selectedByArrow = false; draw(); return; }
      if (key.name === "up" || key.name === "down") {
        if (matches.length) { selected = (selected + (key.name === "down" ? 1 : -1) + matches.length) % matches.length; selectedByArrow = true; }
        else if (history.length) { historyIndex = Math.max(0, Math.min(history.length, historyIndex + (key.name === "down" ? 1 : -1))); buffer = history[historyIndex] ?? ""; cursor = buffer.length; selectedByArrow = false; }
        draw(); return;
      }
      if (key.name === "left") { cursor = Math.max(0, cursor - 1); draw(); return; }
      if (key.name === "right") { cursor = Math.min(buffer.length, cursor + 1); draw(); return; }
      if (key.name === "home" || (key.ctrl && key.name === "a")) { cursor = 0; draw(); return; }
      if (key.name === "end" || (key.ctrl && key.name === "e")) { cursor = buffer.length; draw(); return; }
      if (key.name === "backspace") { if (cursor) { buffer = buffer.slice(0, cursor - 1) + buffer.slice(cursor); cursor--; selected = 0; selectedByArrow = false; } draw(); return; }
      if (key.name === "delete") { if (cursor < buffer.length) { buffer = buffer.slice(0, cursor) + buffer.slice(cursor + 1); selectedByArrow = false; } draw(); return; }
      if (!key.ctrl && !key.meta && character && !/[\r\n\u0000-\u001f]/.test(character)) {
        buffer = buffer.slice(0, cursor) + character + buffer.slice(cursor);
        cursor += character.length;
        selected = 0;
        selectedByArrow = false;
        draw();
      }
    };
    process.stdin.on("keypress", onKey);
    process.stdout.on("resize", draw);
  });
}

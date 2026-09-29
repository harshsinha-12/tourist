import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type MemoryScope = "user" | "codebase" | "episodic";
export interface MemoryNote {
  id: string;
  scope: MemoryScope;
  repo?: string;
  text: string;
  createdAt: string;
}

/** Small persistent record store. An indexed Postgres backend can implement this interface later. */
export class MemoryStore {
  constructor(private readonly path: string) {}

  async list(repo: string): Promise<MemoryNote[]> {
    return (await this.read()).filter((note) => note.scope === "user" || note.repo === repo);
  }

  async retrieve(repo: string, query: string, limit = 6): Promise<MemoryNote[]> {
    const words = new Set(query.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []);
    return (await this.list(repo))
      .map((note) => ({ note, score: (note.text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).filter((word) => words.has(word)).length }))
      .filter(({ note, score }) => note.scope === "user" || score > 0)
      .sort((a, b) => b.score - a.score || b.note.createdAt.localeCompare(a.note.createdAt))
      .slice(0, Math.max(0, Math.min(limit, 8)))
      .map(({ note }) => note);
  }

  async add(scope: MemoryScope, repo: string, text: string): Promise<MemoryNote> {
    if (!text.trim() || text.length > 2_000) throw new Error("Memory text must be 1–2000 characters");
    if (scope !== "user" && !repo) throw new Error("Repository is required for codebase and episodic memory");
    const note: MemoryNote = { id: randomUUID(), scope, ...(scope === "user" ? {} : { repo }), text: text.trim(), createdAt: new Date().toISOString() };
    const all = await this.read();
    all.push(note);
    await this.save(all);
    return note;
  }

  async remove(repo: string, id: string): Promise<boolean> {
    const all = await this.read();
    const index = all.findIndex((note) => note.id === id && (note.scope === "user" || note.repo === repo));
    if (index < 0) return false;
    all.splice(index, 1);
    await this.save(all);
    return true;
  }

  private async read(): Promise<MemoryNote[]> {
    try { return JSON.parse(await readFile(this.path, "utf8")) as MemoryNote[]; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  }

  private async save(notes: MemoryNote[]): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const pending = `${this.path}.${randomUUID()}.tmp`;
    await writeFile(pending, `${JSON.stringify(notes, null, 2)}\n`, { mode: 0o600 });
    await rename(pending, this.path);
  }
}

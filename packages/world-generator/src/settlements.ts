import type { RepositoryFile, SettlementKind } from "@tourist/protocol";

/**
 * Every repository, including this one, is drawn as a bounded set of places.
 * Small folders fold into their parent and deep paths stop earning a district,
 * the same collapse Claude City uses, and the surviving folders share a
 * hamlet, village, town, or city. A file keeps a building of its own only
 * when it is the only file in that place.
 */
export const MAX_CITY_STRUCTURES = 160;

/** Files that share one structure. Eight matches one street block of plots. */
export const FILES_PER_SETTLEMENT = 8;

/** A folder below this size does not earn its own district. */
export const MIN_DISTRICT_FILES = 4;

/** Deeper than this, a folder merges upward even when it is large. */
export const MAX_DISTRICT_DEPTH = 4;

export interface FileGroup {
  /** "" is the repository root. */
  path: string;
  files: RepositoryFile[];
}

export interface SettlementDraft {
  /** Shared directory, or "root" when the files only meet at the repository root. */
  directory: string;
  files: RepositoryFile[];
}

export function settlementKind(fileCount: number): SettlementKind {
  if (fileCount <= 1) return "building";
  if (fileCount <= 5) return "hamlet";
  if (fileCount <= 16) return "village";
  if (fileCount <= 48) return "town";
  return "city";
}

export function planSettlements(files: readonly RepositoryFile[]): SettlementDraft[] {
  const sorted = [...files].sort((left, right) => left.path.localeCompare(right.path));
  if (sorted.length === 0) return [];

  let groups = collapseDirectories(sorted).filter((group) => group.files.length > 0);
  while (groups.length > MAX_CITY_STRUCTURES) groups = mergeSmallest(groups);

  const slots = groups.map((group) => Math.min(
    group.files.length,
    Math.max(1, Math.ceil(group.files.length / FILES_PER_SETTLEMENT)),
  ));
  let total = slots.reduce((sum, count) => sum + count, 0);
  while (total > MAX_CITY_STRUCTURES) {
    let index = -1;
    for (let cursor = 0; cursor < slots.length; cursor += 1) {
      const slot = slots[cursor] ?? 0;
      if (slot <= 1) continue;
      if (index < 0 || slot > (slots[index] ?? 0)) index = cursor;
    }
    if (index < 0) break;
    slots[index] = (slots[index] ?? 1) - 1;
    total -= 1;
  }

  const drafts: SettlementDraft[] = [];
  groups.forEach((group, index) => {
    const pieces = Math.min(slots[index] ?? 1, group.files.length);
    for (const slice of splitEven(group.files, pieces)) {
      drafts.push({ directory: sharedDirectory(slice), files: slice });
    }
  });
  return drafts;
}

export function sharedDirectory(files: readonly RepositoryFile[]): string {
  if (files.length === 0) return "root";
  const parts = files.map((file) => file.path.split("/").slice(0, -1));
  const shortest = Math.min(...parts.map((entry) => entry.length));
  let length = 0;
  while (length < shortest && parts.every((entry) => entry[length] === parts[0]?.[length])) length += 1;
  return parts[0]?.slice(0, length).join("/") || "root";
}

interface DirNode {
  path: string;
  files: RepositoryFile[];
  children: DirNode[];
  fileCount: number;
  depth: number;
}

function collapseDirectories(files: readonly RepositoryFile[]): FileGroup[] {
  const collapsed = collapse(buildTree(files));
  const entries: FileGroup[] = [];
  const visit = (node: DirNode): void => {
    if (node.files.length > 0 || node.children.length === 0) {
      entries.push({ path: node.path, files: sortFiles(node.files) });
    }
    for (const child of node.children) visit(child);
  };
  visit(collapsed);
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

function buildTree(files: readonly RepositoryFile[]): DirNode {
  const root: DirNode = { path: "", files: [], children: [], fileCount: 0, depth: 0 };
  const byPath = new Map<string, DirNode>([["", root]]);
  const nodeFor = (path: string): DirNode => {
    const existing = byPath.get(path);
    if (existing) return existing;
    const slash = path.lastIndexOf("/");
    const parent = nodeFor(slash === -1 ? "" : path.slice(0, slash));
    const node: DirNode = { path, files: [], children: [], fileCount: 0, depth: parent.depth + 1 };
    parent.children.push(node);
    byPath.set(path, node);
    return node;
  };
  for (const file of files) {
    const slash = file.path.lastIndexOf("/");
    nodeFor(slash === -1 ? "" : file.path.slice(0, slash)).files.push(file);
  }
  for (const node of byPath.values()) node.children.sort((left, right) => left.path.localeCompare(right.path));
  const rollUp = (node: DirNode): number => {
    node.fileCount = node.files.length + node.children.reduce((total, child) => total + rollUp(child), 0);
    return node.fileCount;
  };
  rollUp(root);
  return root;
}

function collectFiles(node: DirNode): RepositoryFile[] {
  return [...node.files, ...node.children.flatMap(collectFiles)];
}

function collapse(node: DirNode): DirNode {
  const children: DirNode[] = [];
  for (const child of node.children) {
    const resolved = collapse(child);
    const tooSmall = resolved.fileCount < MIN_DISTRICT_FILES;
    const tooDeep = resolved.depth > MAX_DISTRICT_DEPTH && node.path !== "";
    if (tooSmall || tooDeep) {
      node.files.push(...collectFiles(resolved));
      continue;
    }
    children.push(resolved);
  }
  node.children = children;
  if (node.path !== "" && node.files.length === 0 && node.children.length === 1) return node.children[0]!;
  return node;
}

function mergeSmallest(groups: readonly FileGroup[]): FileGroup[] {
  const ordered = [...groups].sort((left, right) => left.files.length - right.files.length || left.path.localeCompare(right.path));
  const victim = ordered[0];
  if (!victim) return [...groups];
  const host = ordered.find((group) => group !== victim && isAncestor(group.path, victim.path))
    ?? ordered.find((group) => group !== victim);
  if (!host) return [...groups];
  const files = sortFiles([...host.files, ...victim.files]);
  return groups
    .filter((group) => group !== victim)
    .map((group) => group === host ? { path: host.path, files } : group)
    .sort((left, right) => left.path.localeCompare(right.path));
}

function isAncestor(ancestor: string, path: string): boolean {
  if (ancestor === path) return false;
  if (ancestor === "") return true;
  return path.startsWith(`${ancestor}/`);
}

function splitEven<T>(items: readonly T[], pieces: number): T[][] {
  if (items.length === 0) return [];
  const count = Math.max(1, Math.min(pieces, items.length));
  const base = Math.floor(items.length / count);
  let extra = items.length % count;
  const slices: T[][] = [];
  let cursor = 0;
  for (let index = 0; index < count; index += 1) {
    const size = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra -= 1;
    slices.push(items.slice(cursor, cursor + size));
    cursor += size;
  }
  return slices;
}

function sortFiles(files: readonly RepositoryFile[]): RepositoryFile[] {
  return [...files].sort((left, right) => left.path.localeCompare(right.path));
}

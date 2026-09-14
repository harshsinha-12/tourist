import { describe, expect, it } from "vitest";
import { cityPath, parseGitHubRepo } from "./github-repo";

describe("parseGitHubRepo", () => {
  it("accepts full URLs, git suffixes, and owner/repo shorthand", () => {
    expect(parseGitHubRepo("https://github.com/vercel/next.js")).toEqual({ owner: "vercel", repo: "next.js" });
    expect(parseGitHubRepo("github.com/vercel/next.js.git")).toEqual({ owner: "vercel", repo: "next.js" });
    expect(parseGitHubRepo("vercel/next.js")).toEqual({ owner: "vercel", repo: "next.js" });
    expect(parseGitHubRepo("https://github.com/vercel/next.js/tree/canary")).toEqual({ owner: "vercel", repo: "next.js" });
    expect(parseGitHubRepo("not a repo")).toBeNull();
    expect(parseGitHubRepo("")).toBeNull();
    expect(cityPath("vercel", "next.js")).toBe("/vercel/next.js");
  });
});

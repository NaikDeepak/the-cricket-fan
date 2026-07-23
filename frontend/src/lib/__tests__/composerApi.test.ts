import { afterEach, describe, expect, it, vi } from "vitest";
import { composerApi } from "@/lib/composerApi";

afterEach(() => vi.restoreAllMocks());

function mockFetch(json: unknown, ok = true, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok,
    status,
    json: async () => json,
  } as Response);
}

describe("composerApi", () => {
  it("createDraft posts body and returns the draft", async () => {
    const draft = {
      id: 1,
      source: "freeform",
      category: null,
      text: "hi",
      card_type: null,
      card_meta: null,
      status: "draft",
      created_at: "t",
      posted_at: null,
    };
    const f = mockFetch(draft, true, 201);
    const out = await composerApi.createDraft({
      source: "freeform",
      text: "hi",
    });
    expect(out.id).toBe(1);
    const [url, init] = f.mock.calls[0];
    expect(String(url)).toContain("/drafts");
    expect(init?.method).toBe("POST");
  });

  it("generateLlm surfaces a 503 as a typed error", async () => {
    mockFetch(
      { detail: "LLM generation unavailable: GEMINI_API_KEY not configured" },
      false,
      503
    );
    await expect(composerApi.generateLlm({ prompt: "x" })).rejects.toThrow(
      /503/
    );
  });

  it("logEvent returns void on 204", async () => {
    mockFetch(null, true, 204);
    await expect(
      composerApi.logEvent(1, { action: "copied" })
    ).resolves.toBeUndefined();
  });

  it("predictions fetches and returns the list", async () => {
    const f = mockFetch([{ id: 1, team_a: "CSK", team_b: "MI" }]);
    const out = await composerApi.predictions();
    expect(out).toHaveLength(1);
    expect(String(f.mock.calls[0][0])).toContain("/predictions");
  });

  it("predictions passes outcome filter as a query param", async () => {
    const f = mockFetch([]);
    await composerApi.predictions({ outcome: "correct" });
    expect(String(f.mock.calls[0][0])).toContain("outcome=correct");
  });

  it("posts fetches and returns the list", async () => {
    const f = mockFetch([{ id: 1, post_type: "standalone_trivia" }]);
    const out = await composerApi.posts();
    expect(out).toHaveLength(1);
    expect(String(f.mock.calls[0][0])).toContain("/posts");
  });
});

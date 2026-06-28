import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createSerpProvider,
  MOCK_SERP_DEFAULT_LIMIT,
  MOCK_SERP_MAX_LIMIT,
  MockSerpProvider,
  SERP_RESULT_TYPES,
} from "../services/serp";

describe("MockSerpProvider", () => {
  it("returns deterministic results for the same keyword and market input", async () => {
    const provider = new MockSerpProvider();
    const input = {
      keyword: "steam short description generator",
      country: "US",
      language: "en",
      limit: 6,
    };

    const firstRun = await provider.search(input);
    const secondRun = await provider.search(input);
    const differentCountry = await provider.search({ ...input, country: "JP" });
    const differentLanguage = await provider.search({ ...input, language: "ja" });

    assert.deepEqual(secondRun, firstRun);
    assert.notDeepEqual(differentCountry, firstRun);
    assert.notDeepEqual(differentLanguage, firstRun);
  });

  it("handles default, explicit, fractional, zero, negative, and max limits", async () => {
    const provider = new MockSerpProvider();
    const keyword = "unity localization checklist";

    assert.equal((await provider.search({ keyword })).length, MOCK_SERP_DEFAULT_LIMIT);
    assert.equal((await provider.search({ keyword, limit: 3 })).length, 3);
    assert.equal((await provider.search({ keyword, limit: 3.9 })).length, 3);
    assert.equal((await provider.search({ keyword, limit: 0 })).length, 0);
    assert.equal((await provider.search({ keyword, limit: -4 })).length, 0);
    assert.equal((await provider.search({ keyword, limit: 999 })).length, MOCK_SERP_MAX_LIMIT);
  });

  it("returns the required normalized SERP result shape", async () => {
    const provider = new MockSerpProvider();
    const results = await provider.search({
      keyword: "indie game press kit generator",
      country: "DE",
      language: "en",
      limit: 8,
    });

    assert.equal(results.length, 8);

    results.forEach((result, index) => {
      assert.equal(result.position, index + 1);
      assert.equal(typeof result.title, "string");
      assert.ok(result.title.length > 0);
      assert.equal(typeof result.domain, "string");
      assert.ok(result.domain.length > 0);
      assert.equal(typeof result.url, "string");
      assert.ok(result.url.startsWith(`https://${result.domain}/`));
      assert.equal(typeof result.snippet, "string");
      assert.ok(result.snippet.length > 0);
      assert.ok(SERP_RESULT_TYPES.includes(result.resultType ?? "unknown"));
    });
  });
});

describe("SERP provider factory", () => {
  it("exports the mock provider and fails fast for unsupported providers", () => {
    assert.ok(createSerpProvider("mock") instanceof MockSerpProvider);

    assert.throws(
      () => createSerpProvider("serpapi"),
      /Unsupported SERP provider "serpapi"/,
    );
  });
});

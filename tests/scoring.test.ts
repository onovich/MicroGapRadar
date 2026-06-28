import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SCORE_WEIGHTS,
  calculateOpportunityScore,
  normalizeScoreDimension,
} from "../lib/scoring";

describe("calculateOpportunityScore", () => {
  it("uses the docs scoring formula and rounds the final total", () => {
    const result = calculateOpportunityScore({
      scoreHints: {
        intentScore: 90,
        monetizationScore: 80,
        toolabilityScore: 95,
        userFitScore: 90,
        buildSpeedScore: 95,
        riskPenalty: 5,
      },
      serpWeaknessScoreHint: 85,
    });

    const expectedTotal = Math.round(
      90 * SCORE_WEIGHTS.intentScore +
        80 * SCORE_WEIGHTS.monetizationScore +
        85 * SCORE_WEIGHTS.serpWeaknessScore +
        95 * SCORE_WEIGHTS.toolabilityScore +
        90 * SCORE_WEIGHTS.userFitScore +
        95 * SCORE_WEIGHTS.buildSpeedScore -
        5 * SCORE_WEIGHTS.riskPenalty,
    );

    assert.equal(expectedTotal, 83);
    assert.equal(result.totalScore, expectedTotal);
    assert.deepEqual(result.scoreBreakdown, {
      intentScore: 90,
      monetizationScore: 80,
      serpWeaknessScore: 85,
      toolabilityScore: 95,
      userFitScore: 90,
      buildSpeedScore: 95,
      riskPenalty: 5,
      totalScore: 83,
    });
  });

  it("clamps every dimension to a 0-100 integer range", () => {
    const result = calculateOpportunityScore({
      intentScore: "0.9",
      monetizationScore: "120",
      serpWeaknessScore: -20,
      toolabilityScore: 76.6,
      userFitScore: Number.POSITIVE_INFINITY,
      buildSpeedScore: "40.4",
      riskPenalty: "200",
    });

    assert.equal(normalizeScoreDimension(0.78), 78);
    assert.equal(normalizeScoreDimension("0.78"), 78);
    assert.equal(normalizeScoreDimension(-25), 0);
    assert.equal(normalizeScoreDimension(140), 100);
    assert.deepEqual(result.scoreBreakdown, {
      intentScore: 90,
      monetizationScore: 100,
      serpWeaknessScore: 0,
      toolabilityScore: 77,
      userFitScore: 50,
      buildSpeedScore: 40,
      riskPenalty: 100,
      totalScore: 51,
    });
  });

  it("penalizes high-risk opportunities below comparable safer opportunities", () => {
    const lowRisk = calculateOpportunityScore({
      intentScore: 90,
      monetizationScore: 90,
      serpWeaknessScore: 90,
      toolabilityScore: 90,
      userFitScore: 90,
      buildSpeedScore: 90,
      riskLevel: "low",
      riskPenalty: 5,
    });
    const highRisk = calculateOpportunityScore({
      intentScore: 90,
      monetizationScore: 90,
      serpWeaknessScore: 90,
      toolabilityScore: 90,
      userFitScore: 90,
      buildSpeedScore: 90,
      riskLevel: "high",
      riskPenalty: 5,
    });
    const rankedDefaultTopFive = [
      lowRisk,
      calculateOpportunityScore({ ...lowRisk.scoreBreakdown, riskLevel: "low" }),
      calculateOpportunityScore({ ...lowRisk.scoreBreakdown, riskLevel: "low" }),
      calculateOpportunityScore({ ...lowRisk.scoreBreakdown, riskLevel: "low" }),
      calculateOpportunityScore({ ...lowRisk.scoreBreakdown, riskLevel: "low" }),
      highRisk,
    ]
      .sort((left, right) => right.totalScore - left.totalScore)
      .slice(0, 5);

    assert.ok(lowRisk.totalScore > highRisk.totalScore);
    assert.equal(highRisk.scoreBreakdown.riskPenalty, 70);
    assert.match(highRisk.scoreExplanation.riskPenalty, /Poor automation fit/);
    assert.ok(!rankedDefaultTopFive.includes(highRisk));
  });

  it("scores toolable weak-SERP user-fit opportunities higher", () => {
    const genericArticleIdea = calculateOpportunityScore({
      intentScore: 65,
      monetizationScore: 65,
      serpWeaknessScore: 35,
      toolabilityScore: 30,
      userFitScore: 45,
      buildSpeedScore: 75,
      riskPenalty: 10,
    });
    const microtoolGapIdea = calculateOpportunityScore({
      intentScore: 65,
      monetizationScore: 65,
      serpWeaknessScore: 88,
      toolabilityScore: 92,
      userFitScore: 90,
      buildSpeedScore: 75,
      riskPenalty: 10,
    });

    assert.ok(microtoolGapIdea.totalScore > genericArticleIdea.totalScore);
    assert.ok(microtoolGapIdea.scoreBreakdown.serpWeaknessScore > genericArticleIdea.scoreBreakdown.serpWeaknessScore);
    assert.ok(microtoolGapIdea.scoreBreakdown.toolabilityScore > genericArticleIdea.scoreBreakdown.toolabilityScore);
    assert.ok(microtoolGapIdea.scoreBreakdown.userFitScore > genericArticleIdea.scoreBreakdown.userFitScore);
  });

  it("handles missing and invalid hints with deterministic defaults", () => {
    const input = {
      scoreHints: {
        intentScore: "",
        monetizationScore: "not numeric",
        toolabilityScore: undefined,
        userFitScore: null,
        buildSpeedScore: Number.NaN,
        riskPenalty: "nope",
      },
      serpWeaknessScoreHint: "82",
    };
    const firstRun = calculateOpportunityScore(input);
    const secondRun = calculateOpportunityScore(input);

    assert.deepEqual(secondRun, firstRun);
    assert.deepEqual(firstRun.scoreBreakdown, {
      intentScore: 50,
      monetizationScore: 50,
      serpWeaknessScore: 82,
      toolabilityScore: 50,
      userFitScore: 50,
      buildSpeedScore: 50,
      riskPenalty: 35,
      totalScore: 51,
    });
  });

  it("returns a score_explanation-compatible explanation for every field", () => {
    const result = calculateOpportunityScore({
      intentScore: 90,
      monetizationScore: 80,
      serpWeaknessScore: 85,
      toolabilityScore: 95,
      userFitScore: 90,
      buildSpeedScore: 95,
      riskPenalty: 5,
    });

    assert.deepEqual(Object.keys(result.scoreExplanation), [
      "intentScore",
      "monetizationScore",
      "serpWeaknessScore",
      "toolabilityScore",
      "userFitScore",
      "buildSpeedScore",
      "riskPenalty",
      "totalScore",
    ]);

    for (const explanation of Object.values(result.scoreExplanation)) {
      assert.equal(typeof explanation, "string");
      assert.ok(explanation.length > 0);
      assert.ok(explanation.length <= 120);
    }

    assert.match(result.scoreExplanation.intentScore, /Search intent/);
    assert.match(result.scoreExplanation.riskPenalty, /subtracts/);
    assert.match(result.scoreExplanation.totalScore, /83\/100/);

    const highRisk = calculateOpportunityScore({ riskPenalty: 70 });
    const excludedRisk = calculateOpportunityScore({ riskPenalty: 100 });

    assert.match(highRisk.scoreExplanation.riskPenalty, /Poor automation fit/);
    assert.match(highRisk.scoreExplanation.riskPenalty, /review before ranking/);
    assert.match(excludedRisk.scoreExplanation.riskPenalty, /do-not-build/);
    assert.match(excludedRisk.scoreExplanation.riskPenalty, /outside numeric total/);
  });
});

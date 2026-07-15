#!/usr/bin/env bun
// Eval CLI — runs the evaluation suite and prints results.
//
// Usage:
//   bun run scripts/eval.ts              # run all queries
//   bun run scripts/eval.ts r1 r2 f1     # run specific query IDs
//   bun run scripts/eval.ts --type=factual   # run by type
//
// Output: JSON summary + per-query table.

import { runEvalSuite } from "../src/lib/eval/runner";
import { EVAL_DATASET } from "../src/lib/eval/dataset";

async function main() {
  const args = process.argv.slice(2);

  // Parse args.
  let queries: string[] | undefined;
  let typeFilter: string | undefined;

  for (const arg of args) {
    if (arg.startsWith("--type=")) {
      typeFilter = arg.slice(7);
    } else if (!arg.startsWith("-")) {
      if (!queries) queries = [];
      queries.push(arg);
    }
  }

  // If type filter, resolve to query IDs.
  if (typeFilter && !queries) {
    queries = EVAL_DATASET.filter((q) => q.type === typeFilter).map((q) => q.id);
  }

  console.log("=".repeat(60));
  console.log("Cognis — Evaluation Suite");
  console.log("=".repeat(60));
  console.log(`Queries: ${queries ? queries.length : EVAL_DATASET.length}`);
  console.log("");

  const startTime = Date.now();
  const result = await runEvalSuite({ queries });
  const totalElapsed = Date.now() - startTime;

  console.log("");
  console.log("=".repeat(60));
  console.log("RESULTS");
  console.log("=".repeat(60));

  // Per-query table.
  console.log("");
  console.log("Per-query results:");
  console.log("-".repeat(80));
  console.log("ID    Type      Diff    Score  Status  Time");
  console.log("-".repeat(80));
  for (const r of result.results) {
    const query = EVAL_DATASET.find((q) => q.id === r.queryId);
    const diff = (query?.difficulty || "?").padEnd(8);
    const type = r.type.padEnd(10);
    const score = String(r.score).padStart(3) + "%";
    const status = r.passed ? "PASS" : "FAIL";
    const time = (r.details.responseTimeMs / 1000).toFixed(1) + "s";
    console.log(`${r.queryId.padEnd(5)} ${type} ${diff} ${score.padEnd(6)} ${status.padEnd(7)} ${time}`);
    if (r.details.error) {
      console.log(`         error: ${r.details.error.slice(0, 100)}`);
    }
  }

  // Summary.
  console.log("");
  console.log("-".repeat(60));
  console.log("SUMMARY");
  console.log("-".repeat(60));
  console.log(`Total:       ${result.summary.total}`);
  console.log(`Passed:      ${result.summary.passed}`);
  console.log(`Failed:      ${result.summary.failed}`);
  console.log(`Pass rate:   ${((result.summary.passed / result.summary.total) * 100).toFixed(1)}%`);
  console.log(`Avg score:   ${result.summary.avgScore}%`);
  console.log(`Avg time:    ${(result.summary.avgTimeMs / 1000).toFixed(1)}s`);
  console.log(`Total time:  ${(totalElapsed / 1000).toFixed(1)}s`);
  console.log(`Tokens used: ${result.summary.totalTokens}`);

  console.log("");
  console.log("By type:");
  for (const [type, stats] of Object.entries(result.summary.byType)) {
    const rate = ((stats.passed / stats.total) * 100).toFixed(1);
    console.log(`  ${type.padEnd(10)} ${stats.passed}/${stats.total} (${rate}%) avg=${stats.avgScore.toFixed(0)}%`);
  }

  console.log("");
  console.log("Full JSON:");
  console.log(JSON.stringify(result, null, 2));

  process.exit(result.summary.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Eval failed:", err);
  process.exit(1);
});

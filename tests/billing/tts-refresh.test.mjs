import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

test("actual speech refresh effect clears only its recovered loading error and ignores unmounted results", async () => {
  const source = readFileSync(new URL("../../src/components/tts-client.tsx", import.meta.url), "utf8");
  const start = source.indexOf("  useEffect(() => {");
  const end = source.indexOf("\n  }, []);", start) + "\n  }, []);".length;
  assert.ok(start >= 0 && end > start);
  const effectSource = source.slice(start, end).replace("useEffect(", "capture(");
  let effect, error = "", selected = "", fail = true, models = [], focus;
  const update = (current, value) => typeof value === "function" ? value(current) : value;
  const script = ts.transpileModule(effectSource, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(script, {
    capture: (callback) => { effect = callback; }, URLSearchParams,
    modelLoadingError: "Speech models are unavailable right now.",
    setError: (value) => { error = update(error, value); },
    setModelId: (value) => { selected = update(selected, value); },
    setModels: (value) => { models = value; },
    window: { location: { search: "" }, addEventListener: (_name, callback) => { focus = callback; }, removeEventListener() {} },
    fetch: async () => {
      if (fail) throw new Error("connection failed");
      return { ok: true, json: async () => ({ models: [{ id: "minimax-speech-2-8-hd", capabilities: ["tts"], available: true }] }) };
    },
  });
  const cleanup = effect();
  await new Promise(setImmediate);
  assert.equal(error, "Speech models are unavailable right now.");
  fail = false;
  await focus();
  assert.equal(error, "");
  assert.equal(selected, "minimax-speech-2-8-hd");
  assert.equal(models.length, 1);
  error = "Generation failed. Please try again.";
  await focus();
  assert.equal(error, "Generation failed. Please try again.");
  cleanup();
  fail = true;
  await focus();
  assert.equal(error, "Generation failed. Please try again.");
});

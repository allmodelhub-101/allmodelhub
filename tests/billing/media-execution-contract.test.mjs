import assert from "node:assert/strict";
import test from "node:test";
import {
  getMediaExecutionContract,
  mediaContractUiSchema,
  mediaUiSchemaMatchesContract,
  referencePayload,
  validateMediaContractRequest,
} from "../../src/lib/media-execution-contract.ts";

test("image workflow state is translated to documented reference fields", () => {
  const flux = getMediaExecutionContract("flux-2-klein-4b");
  const kling = getMediaExecutionContract("kling-v3-image");
  assert.deepEqual(referencePayload(flux, ["a", "b"]), { image_urls: ["a", "b"] });
  assert.deepEqual(referencePayload(kling, ["a"]), { image_reference: "a" });
  assert.equal("mode" in referencePayload(flux, ["a"]), false);
});

test("image contracts reject unsupported editing and require explicit priced resolution", () => {
  const gpt = getMediaExecutionContract("gpt-image-2");
  assert.throws(() => validateMediaContractRequest(gpt, { referenceCount: 0 }), /resolution/);
  assert.doesNotThrow(() => validateMediaContractRequest(gpt, { referenceCount: 16, resolution: "1K", aspectRatio: "1:1" }));
  assert.throws(() => validateMediaContractRequest(gpt, { referenceCount: 17, resolution: "1K" }), /references/);
  const upscaler = getMediaExecutionContract("real-esrgan");
  assert.throws(() => validateMediaContractRequest(upscaler, { referenceCount: 0, resolution: "4K" }), /reference_required/);
});

test("advertised UI options stay inside the executable adapter contract", () => {
  for (const modelId of ["doubao-seedream-5-0-pro", "flux-2-klein-4b", "gpt-image-2", "qwen3-image-pro", "real-esrgan",
    "gemini-3-1-flash-image", "gemini-3-pro-image", "gpt-image-2-5-flare", "gpt-image-2-5-sunburst"]) {
    const contract = getMediaExecutionContract(modelId);
    assert.equal(mediaUiSchemaMatchesContract(mediaContractUiSchema(contract), contract), true, modelId);
  }
});

test("quality-bound image contracts reject unsupported provider options", () => {
  const flare = getMediaExecutionContract("gpt-image-2-5-flare");
  assert.doesNotThrow(() => validateMediaContractRequest(flare, { referenceCount: 0, resolution: "1K", quality: "medium" }));
  assert.throws(() => validateMediaContractRequest(flare, { referenceCount: 0, resolution: "1K", quality: "high" }), /quality/);
});

export const minimaxVoices = [
  { value: "male-qn-qingse", label: "Qingse · MiniMax male", note: "MiniMax system voice" },
  { value: "female-shaonv", label: "Shaonv · MiniMax female", note: "MiniMax system voice" },
] as const;

export function isMinimaxSpeech(modelId: string) {
  return ["minimax-speech-2-8-turbo", "minimax-speech-2-8-hd"].includes(modelId);
}

// Only verified system voices are exposed. Voice cloning/design needs its own
// authorization and is deliberately not inferred from a free-form voice ID.
export function minimaxSpeechPayload(input: {
  modelId: string; text: string; voiceId?: string; languageCode?: string; voiceSpeed?: number;
}) {
  if (!isMinimaxSpeech(input.modelId)) throw new Error("MEDIA_ADAPTER_UNAVAILABLE");
  if (!input.text.trim() || Array.from(input.text).length > 10_000) throw new Error("MEDIA_OPTION_UNSUPPORTED:prompt");
  if (!minimaxVoices.some((voice) => voice.value === input.voiceId)) throw new Error("MEDIA_OPTION_UNSUPPORTED:voice");
  if (input.languageCode !== undefined || input.voiceSpeed !== undefined) throw new Error("MEDIA_OPTION_UNSUPPORTED:voice_setting");
  return { text: input.text, voice_id: input.voiceId };
}

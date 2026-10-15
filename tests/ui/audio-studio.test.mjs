import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=n=>readFileSync(new URL(`../../src/components/${n}`,import.meta.url),"utf8");

test("audio modes expose keyboard navigation and a labeled panel",()=>{
 const studio=source('audio-studio.tsx');
 for(const key of ['ArrowRight','ArrowLeft','Home','End'])assert(studio.includes(key));
 assert(studio.includes('role="tabpanel"')&&studio.includes('aria-controls="audio-mode-panel"'));
 assert(studio.includes('tabIndex={mode===item?0:-1}'));
});
test("decorative artwork cannot be confused with audio playback and motion is optional",()=>{
 const stage=source('audio-stage.tsx'),css=source('audio-studio.module.css');
 assert(stage.includes('aria-hidden="true"')&&stage.includes('STUDIO VISUAL'));
 assert(!stage.includes('<audio')&&!stage.includes('onClick'));
 assert(css.includes('data-motion-paused="true"')&&css.includes('prefers-reduced-motion:reduce'));
 assert(css.includes('animation-play-state:paused!important'));
});
test("first-loaded Kling voice matches its provider and financial confirmation remains guarded",()=>{
 const speech=source('tts-client.tsx');
 assert(speech.includes('const selectedVoice = voices.some((item) => item.value === voice) ? voice : voices[0].value'));
 assert(speech.includes('const asyncSpeech = asyncKling || asyncMinimax'));
 assert(speech.includes('voiceId: selectedVoice'));
 assert(speech.includes('expensive && !confirmed'));
 assert(speech.includes('confirmedCost: confirmed || !expensive'));
 assert(speech.includes('languageCode, voiceSpeed: Number(voiceSpeed)'));
 assert(speech.includes('aria-label={`Select ${item.label.split(" · ")[0]} voice`}'));
});
test("music and sound effects cannot re-submit an active job or invent a final charge",()=>{
 const media=source('audio-generation-client.tsx');
 assert(media.includes('if (busy || activeJob || !modelId || !prompt.trim()) return'));
 assert(media.includes('disabled={busy || activeJob || !modelId || !prompt.trim()}'));
 assert(media.includes('job?.charged_credits != null'));
 assert(!media.includes('job?.charged_credits || job?.estimated_credits'));
 assert(media.includes('Final charge pending'));
 assert(media.includes('requestId: crypto.randomUUID()')&&media.includes('confirmedCost: true'));
 assert(media.includes('<audio controls src={resultUrl}'));
});

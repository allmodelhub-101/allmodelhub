import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../../src/components/'+name,import.meta.url),'utf8');
test('idle studio visuals animate in every mode without bypassing pause or reduced motion',()=>{
 const css=read('audio-studio.module.css');
 assert(!css.includes('.soundStage:not(.rendering) * { animation-play-state:paused; }'));
 assert(css.includes('data-motion-paused="true"'));assert(css.includes('animation-play-state:paused!important'));
 assert(css.includes('prefers-reduced-motion:reduce'));assert(css.includes('animation:audioGleam'));
});
test('script tools are local explicit actions, never generation or clipboard-read requests',()=>{
 const editor=read('speech-script-editor.tsx');
 assert(!editor.includes('fetch('));assert(!editor.includes('readText('));
 assert(editor.includes('type="button"'));assert(editor.includes('navigator.clipboard.writeText(value)'));
 assert(editor.includes('setUndo(value)'));assert(editor.includes('onChange(undo)'));
 assert(editor.includes('file.text()'));assert(editor.includes('text.length > limit'));
 assert(editor.includes('file.size > 100_000'));assert(editor.includes('maxLength={limit}'));
 assert(editor.includes('role="status"'));assert(editor.includes('aria-describedby='));
});
test('speech integration preserves authorization and clears confirmation on script edits',()=>{
 const speech=read('tts-client.tsx');
 assert(speech.includes('<SpeechScriptEditor value={text} onChange={value => { setText(value); setConfirmed(false); }} limit={scriptLimit} busy={busy} />'));
 assert(speech.includes('expensive && !confirmed'));assert(speech.includes('confirmedCost: confirmed || !expensive'));
 assert(speech.includes('voiceId: selectedVoice'));
});

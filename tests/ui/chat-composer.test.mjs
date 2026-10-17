import test from 'node:test';
import assert from 'node:assert/strict';
import {chatComposerKeyAction,chatPromptWithContext,pastedChatContext} from '../../src/lib/chat-composer-events.ts';
test('Enter sends, Shift Enter and IME preserve native editing',()=>{
 assert.equal(chatComposerKeyAction({key:'Enter',shiftKey:false,isComposing:false},false),'send');
 assert.equal(chatComposerKeyAction({key:'Enter',shiftKey:true,isComposing:false},false),null);
 assert.equal(chatComposerKeyAction({key:'Enter',shiftKey:false,isComposing:true},false),null);
});
test('Escape stops only an active request and unrelated keys remain native',()=>{
 assert.equal(chatComposerKeyAction({key:'Escape',shiftKey:false,isComposing:false},true),'stop');
 assert.equal(chatComposerKeyAction({key:'Escape',shiftKey:false,isComposing:false},false),null);
 assert.equal(chatComposerKeyAction({key:'ArrowLeft',shiftKey:false,isComposing:false},true),null);
});
test('context threshold and exact submitted prompt formatting are unchanged',()=>{
 assert.equal(pastedChatContext('x'.repeat(1200)),null);assert.equal(pastedChatContext('x'.repeat(1201)),'x'.repeat(1201));
 assert.equal(chatPromptWithContext('  unchanged  ',''),'  unchanged  ');
 assert.equal(chatPromptWithContext('  Analyze  ','evidence'),'Analyze\n\n[Pasted context]\nevidence');
 assert.equal(chatPromptWithContext('','evidence'),'Use the attached context to help me.\n\n[Pasted context]\nevidence');
});

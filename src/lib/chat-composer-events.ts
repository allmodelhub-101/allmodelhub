// Pure input policy shared by the production controller and local presentation fixture.
export function chatComposerKeyAction(event:{key:string;shiftKey:boolean;isComposing:boolean},busy:boolean):"send"|"stop"|null {
  if(event.key==="Enter"&&!event.shiftKey&&!event.isComposing)return "send";
  if(event.key==="Escape"&&busy)return "stop";
  return null;
}
export function chatPromptWithContext(input:string,pastedContext:string){
  return pastedContext ? `${input.trim() || "Use the attached context to help me."}\n\n[Pasted context]\n${pastedContext}` : input;
}
export function pastedChatContext(text:string){return text.length>1200?text:null}

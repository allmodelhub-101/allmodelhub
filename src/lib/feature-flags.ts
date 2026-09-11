import { createAdminClient } from "@/lib/supabase/admin";
export type FeatureKey="audio_studio"|"cross_modality_handoffs"|"generation_center"|"image_studio"|"model_battle"|"private_chat"|"prompt_enhancer"|"teams"|"unified_library"|"unified_shell"|"video_studio";
const defaults:Record<FeatureKey,boolean>={audio_studio:true,cross_modality_handoffs:false,generation_center:true,image_studio:true,model_battle:true,private_chat:true,prompt_enhancer:true,teams:false,unified_library:true,unified_shell:true,video_studio:true};
export async function getFeatureFlags(){try{const admin=createAdminClient();const {data,error}=await admin.from("feature_flags").select("key,enabled");if(error)throw error;const flags={...defaults};for(const row of data??[]){if(row.key in flags)flags[row.key as FeatureKey]=Boolean(row.enabled)}return flags}catch{return {...defaults}}}
export async function isFeatureEnabled(key:FeatureKey){return (await getFeatureFlags())[key]}


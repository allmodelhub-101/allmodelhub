import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Only newly created temporary objects; never user files or financial history.
export async function cleanupTemporaryMedia() {
  const admin = createAdminClient();
  const old = new Date(Date.now() - 3 * 3600000).toISOString(); // upload tokens expire after 2h
  const { data: sessions, error } = await admin.from("media_upload_sessions")
    .select("id,storage_path,destination_path,completed_at,user_id,reservation_id").lt("created_at", old).limit(20);
  if (error) throw error;
  for (const session of sessions ?? []) {
    const { error: removeError } = await admin.storage.from("media-uploads").remove([session.storage_path]);
    if (removeError) continue;
    if (!session.completed_at) {
      const { data: file, error: fileError } = await admin.from("user_files").select("id").eq("id", session.id).maybeSingle();
      if (fileError) continue;
      if (!file) {
        const { error: orphanError } = await admin.storage.from("user-files").remove([session.destination_path]);
        if (orphanError) continue;
      }
      await admin.rpc("release_file_upload_reservation", { p_reservation_id: session.reservation_id, p_user_id: session.user_id });
    }
    await admin.from("media_upload_sessions").delete().eq("id", session.id);
  }
  const { data: assets, error: assetError } = await admin.from("provider_input_assets")
    .select("token_hash,storage_path").lt("expires_at", new Date(Date.now() - 5 * 60000).toISOString()).limit(20);
  if (assetError) throw assetError;
  for (const asset of assets ?? []) {
    const { error } = await admin.storage.from("provider-inputs").remove([asset.storage_path]);
    if (!error) await admin.from("provider_input_assets").delete().eq("token_hash", asset.token_hash);
  }
}


import { supabase } from "./supabase";

export type DriverChatMessage = {
  id: string;
  sender_id: string;
  sender_name: string;
  body: string;
  created_at: string;
};

export async function listDriverChatMessages(): Promise<DriverChatMessage[]> {
  const { data, error } = await supabase
    .from("driver_chat_messages")
    .select("id,sender_id,sender_name,body,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).reverse() as DriverChatMessage[];
}

export async function sendDriverChatMessage(senderId: string, body: string): Promise<void> {
  const clean = body.trim();
  if (!clean) throw new Error("Write a message first.");
  if (clean.length > 1000) throw new Error("Messages must be 1,000 characters or fewer.");
  const { error } = await supabase
    .from("driver_chat_messages")
    .insert({ sender_id: senderId, body: clean });
  if (error) throw error;
}

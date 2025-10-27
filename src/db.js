// src/db.js
import { supabase } from "./supabaseClient";

// LISTAR
export async function listLicencas() {
  const { data, error } = await supabase
    .from("licencas")
    .select("*")
    .order("vencimento", { ascending: true });
  if (error) throw error;
  return data || [];
}

// INSERIR
export async function insertLicenca(payload) {
  const { data, error } = await supabase
    .from("licencas")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ATUALIZAR
export async function updateLicenca(id, payload) {
  const { data, error } = await supabase
    .from("licencas")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// EXCLUIR
export async function deleteLicenca(id) {
  const { error } = await supabase
    .from("licencas")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// REALTIME (insere/edita/exclui)
export function subscribeLicencas(onUpsert, onDelete) {
  const channel = supabase.channel("realtime:licencas");

  channel.on(
    "postgres_changes",
    { event: "*", schema: "public", table: "licencas" },
    (payload) => {
      if (payload.eventType === "DELETE") {
        onDelete?.(payload.old);
      } else {
        onUpsert?.(payload.new);
      }
    }
  );

  channel.subscribe();

  // cleanup
  return () => supabase.removeChannel(channel);
}

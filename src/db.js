// src/db.js
import { supabase } from "./supabaseClient";

// LISTAR
// listLicencas: inclua os campos na projeção ou apenas use .select('*')
export async function listLicencas() {
  const { data, error } = await supabase
    .from('licencas')
    .select('*') // pega também protocolo, observacao, renovacao_prazo
    .order('vencimento', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function insertLicenca(payload) {
  const { data, error } = await supabase
    .from('licencas')
    .insert([{
      tipo: payload.tipo,
      orgao: payload.orgao,
      numero: payload.numero || '',
      empresa: payload.empresa,
      municipio: payload.municipio,
      uf: payload.uf,
      emissao: payload.emissao,
      vencimento: payload.vencimento,
      responsavel: payload.responsavel,
      situacao: payload.situacao,
      protocolo: payload.protocolo || null,
      observacao: payload.observacao || null,
      renovacao_prazo: payload.renovacao_prazo || null,
    }])
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateLicenca(id, payload) {
  const { data, error } = await supabase
    .from('licencas')
    .update({
      tipo: payload.tipo,
      orgao: payload.orgao,
      numero: payload.numero || '',
      empresa: payload.empresa,
      municipio: payload.municipio,
      uf: payload.uf,
      emissao: payload.emissao,
      vencimento: payload.vencimento,
      responsavel: payload.responsavel,
      situacao: payload.situacao,
      protocolo: payload.protocolo || null,
      observacao: payload.observacao || null,
      renovacao_prazo: payload.renovacao_prazo || null,
    })
    .eq('id', id)
    .select('*')
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

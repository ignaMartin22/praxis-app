import { supabase } from '../supabase';

export type Expediente = {
  id: string;
  numero_expediente: string;
  caratula: string;
  cliente_apellido: string;
  estado: string;
  fecha_vencimiento: string | null;
};

export const ESTADOS_ACTIVOS = ['En inicio', 'En prueba', 'Para alegar', 'Sentencia'];

export async function fetchExpedientes({ archivados }: { archivados: boolean }) {
  let query = supabase
    .from('expedientes')
    .select('*')
    .order('creado_el', { ascending: false });

  if (archivados) {
    query = query.eq('estado', 'Archivado');
  } else {
    query = query.neq('estado', 'Archivado');
  }

  const { data, error } = await query;
  return { data: (data as Expediente[] | null) ?? null, error };
}

export async function archivarExpediente(expedienteId: string) {
  const { error } = await supabase
    .from('expedientes')
    .update({ estado: 'Archivado' })
    .eq('id', expedienteId);
  return { error };
}

export async function restaurarExpediente(expedienteId: string, estado: string) {
  const { error } = await supabase
    .from('expedientes')
    .update({ estado })
    .eq('id', expedienteId);
  return { error };
}
import { supabase } from '../supabase';
import { requiereConexion } from './connectividad';
import { eliminarExpedienteCache } from './cache';
import { STORAGE_BUCKET } from './expedientePdfs';

export type Expediente = {
  id: string;
  numero_expediente: string;
  caratula: string;
  cliente_apellido: string;
  estado: string;
  fecha_vencimiento: string | null;
};

export const ESTADOS_ACTIVOS = ['En inicio', 'En prueba', 'Para alegar', 'Sentencia'];

export type NuevoExpediente = {
  tenant_id: string | null;
  numero_expediente: string;
  caratula: string;
  cliente_apellido: string;
  estado: string;
  fecha_vencimiento: string | null;
};

export async function crearExpediente(input: NuevoExpediente): Promise<{ error: string | null }> {
  const sinConexion = requiereConexion();
  if (sinConexion) return { error: sinConexion };
  if (!input.tenant_id) return { error: 'Tu sesión no es válida. Volvé a iniciar sesión.' };

  const { error } = await supabase.from('expedientes').insert({
    numero_expediente: input.numero_expediente,
    caratula: input.caratula,
    cliente_apellido: input.cliente_apellido,
    estado: input.estado,
    tenant_id: input.tenant_id,
    fecha_vencimiento: input.fecha_vencimiento,
  });

  if (error) return { error: 'No se pudo crear el expediente. Intentá de nuevo.' };
  return { error: null };
}

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

export async function cambiarEstadoExpediente(expedienteId: string, estado: string): Promise<{ error: string | null }> {
  const sinConexion = requiereConexion();
  if (sinConexion) return { error: sinConexion };

  const { error } = await supabase.from('expedientes').update({ estado }).eq('id', expedienteId);
  if (error) return { error: 'No se pudo actualizar el estado. Intentá de nuevo.' };
  return { error: null };
}

export async function archivarExpediente(expedienteId: string): Promise<{ error: string | null }> {
  const sinConexion = requiereConexion();
  if (sinConexion) return { error: sinConexion };

  const { error } = await supabase
    .from('expedientes')
    .update({ estado: 'Archivado' })
    .eq('id', expedienteId);
  if (error) return { error: 'No se pudo archivar el expediente. Intentá de nuevo.' };
  return { error: null };
}

export async function restaurarExpediente(expedienteId: string, estado: string): Promise<{ error: string | null }> {
  const sinConexion = requiereConexion();
  if (sinConexion) return { error: sinConexion };

  const { error } = await supabase
    .from('expedientes')
    .update({ estado })
    .eq('id', expedienteId);
  if (error) return { error: 'No se pudo restaurar el expediente. Intentá de nuevo.' };
  return { error: null };
}

export async function eliminarExpedienteDefinitivo(expedienteId: string): Promise<{ error: string | null }> {
  const sinConexion = requiereConexion();
  if (sinConexion) return { error: sinConexion };

  const { data: pdfs, error: pdfsError } = await supabase
    .from('expediente_pdfs')
    .select('storage_path')
    .eq('expediente_id', expedienteId);

  if (pdfsError) return { error: 'No se pudieron verificar los documentos del expediente.' };

  if (pdfs && pdfs.length > 0) {
    const paths = pdfs.map((p) => p.storage_path);
    const { error: storageError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove(paths);

    if (storageError) return { error: 'No se pudieron eliminar los documentos. Intentá de nuevo.' };
  }

  const { error } = await supabase.from('expedientes').delete().eq('id', expedienteId);
  if (error) return { error: 'No se pudo eliminar el expediente. Intentá de nuevo.' };

  await eliminarExpedienteCache(expedienteId);

  return { error: null };
}
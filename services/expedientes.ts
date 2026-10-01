import { supabase } from '../supabase';
import { eliminarArchivosDeExpediente } from './expedientePdfs';

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

export type ResultadoEliminar = { error: string | null };

// Borrado definitivo: primero los archivos de Storage y después el expediente
// (la cascada elimina filas de documentos y plazos). Si algo falla a mitad de
// camino el usuario puede reintentar sin dejar archivos sin registro.
export async function eliminarExpedienteDefinitivo(expedienteId: string): Promise<ResultadoEliminar> {
  const archivos = await eliminarArchivosDeExpediente(expedienteId);
  if (archivos.error) return { error: archivos.error };

  const { error } = await supabase.from('expedientes').delete().eq('id', expedienteId);
  if (error) return { error: 'No se pudo eliminar el expediente. Intentá de nuevo.' };

  return { error: null };
}

export async function restaurarExpediente(expedienteId: string, estado: string) {
  const { error } = await supabase
    .from('expedientes')
    .update({ estado })
    .eq('id', expedienteId);
  return { error };
}
import { supabase } from '../supabase';
import { requiereConexion } from './connectividad';
import { eliminarPdfCache } from './cache';
import type { ExpedientePdf, TipoDocumento } from '../types/database';

export const MAX_PDFS_POR_EXPEDIENTE = 5;

const TIPOS_DOCUMENTO: Record<
  TipoDocumento,
  { mimes: string[]; extension: string; maxBytes: number }
> = {
  pdf: {
    mimes: ['application/pdf'],
    extension: '.pdf',
    maxBytes: 15 * 1024 * 1024,
  },
  docx: {
    mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    extension: '.docx',
    maxBytes: 15 * 1024 * 1024,
  },
  jpg: {
    mimes: ['image/jpeg'],
    extension: '.jpg',
    maxBytes: 10 * 1024 * 1024,
  },
  png: {
    mimes: ['image/png'],
    extension: '.png',
    maxBytes: 10 * 1024 * 1024,
  },
};

export const STORAGE_BUCKET = 'expediente-pdfs';

export type PdfParaSubir = {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
};

export type ResultadoPdf<T> = { data: T | null; error: string | null };

function generarUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function tieneExtensionCorrecta(nombre: string, tipo: TipoDocumento): boolean {
  return nombre.toLowerCase().endsWith(TIPOS_DOCUMENTO[tipo].extension);
}

export async function listarPdfs(expedienteId: string): Promise<ResultadoPdf<ExpedientePdf[]>> {
  const { data, error } = await supabase
    .from('expediente_pdfs')
    .select('*')
    .eq('expediente_id', expedienteId)
    .order('creado_el', { ascending: true });

  if (error) return { data: null, error: 'No se pudieron cargar los documentos.' };
  return { data: (data ?? []) as ExpedientePdf[], error: null };
}

export async function subirDocumento(
  expedienteId: string,
  tenantId: string,
  archivo: PdfParaSubir,
  tipo: TipoDocumento
): Promise<ResultadoPdf<ExpedientePdf>> {
  const sinConexion = requiereConexion();
  if (sinConexion) return { data: null, error: sinConexion };
  if (!tenantId) return { data: null, error: 'Tu sesión no es válida. Volvé a iniciar sesión.' };

  const configTipo = TIPOS_DOCUMENTO[tipo];
  const nombre = (archivo.name || `documento${configTipo.extension}`).split('/').pop() ?? `documento${configTipo.extension}`;

  const mimeValido = archivo.mimeType ? configTipo.mimes.includes(archivo.mimeType) : true;
  if (!mimeValido || !tieneExtensionCorrecta(nombre, tipo)) {
    return { data: null, error: `El archivo no es un documento de tipo ${tipo.toUpperCase()} válido.` };
  }

  if (archivo.size != null && archivo.size > configTipo.maxBytes) {
    return {
      data: null,
      error: `El archivo supera el tamaño máximo permitido (${Math.round(configTipo.maxBytes / 1024 / 1024)} MB).`,
    };
  }

  const { count, error: countError } = await supabase
    .from('expediente_pdfs')
    .select('id', { count: 'exact', head: true })
    .eq('expediente_id', expedienteId);

  if (countError) return { data: null, error: 'No se pudo verificar el límite de documentos.' };
  if ((count ?? 0) >= MAX_PDFS_POR_EXPEDIENTE) {
    return { data: null, error: `Límite alcanzado: máximo ${MAX_PDFS_POR_EXPEDIENTE} documentos por expediente.` };
  }

  const id = generarUuid();
  const storagePath = `${tenantId}/${expedienteId}/${id}${configTipo.extension}`;

  try {
    const respuesta = await fetch(archivo.uri);
    if (!respuesta.ok) return { data: null, error: 'No se pudo leer el archivo seleccionado.' };
    const bytes = new Uint8Array(await respuesta.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, bytes, { contentType: configTipo.mimes[0], upsert: false });

    if (uploadError) return { data: null, error: 'No se pudo subir el archivo. Intentá de nuevo.' };

    const { data, error: insertError } = await supabase
      .from('expediente_pdfs')
      .insert({
        expediente_id: expedienteId,
        tenant_id: tenantId,
        storage_path: storagePath,
        nombre_original: nombre,
        tipo_documento: tipo,
        tamano_bytes: bytes.byteLength,
      })
      .select()
      .single();

    if (insertError) {
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
      const errorSafe =
        insertError.code === 'P0001' || insertError.code === '23514'
          ? `Límite alcanzado: máximo ${MAX_PDFS_POR_EXPEDIENTE} documentos por expediente.`
          : 'No se pudo registrar el documento. Intentá de nuevo.';
      return { data: null, error: errorSafe };
    }

    return { data: data as ExpedientePdf, error: null };
  } catch {
    return { data: null, error: 'No se pudo subir el archivo. Intentá de nuevo.' };
  }
}

export async function eliminarPdf(pdf: ExpedientePdf): Promise<ResultadoPdf<null>> {
  const sinConexion = requiereConexion();
  if (sinConexion) return { data: null, error: sinConexion };

  const { error } = await supabase.from('expediente_pdfs').delete().eq('id', pdf.id);
  if (error) return { data: null, error: 'No se pudo eliminar el documento. Intentá de nuevo.' };

  await supabase.storage.from(STORAGE_BUCKET).remove([pdf.storage_path]);
  await eliminarPdfCache(pdf.id);

  return { data: null, error: null };
}

export async function obtenerUrlFirmada(pdf: ExpedientePdf): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(pdf.storage_path, 60);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
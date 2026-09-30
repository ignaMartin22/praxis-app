-- =============================================================================
-- Archivos huérfanos en Storage (solo lectura, no modifica nada)
-- Ejecutar en: Dashboard de Supabase > SQL Editor
-- Lista los objetos del bucket 'expediente-pdfs' que no tienen fila en
-- public.expediente_pdfs (p. ej. si falló el borrado del objeto tras borrar la fila).
-- No borrar con SQL: eso no elimina el archivo físico. Borrarlos desde el
-- Dashboard (Storage) o con la API de Storage.
-- =============================================================================

select o.name as storage_path, o.created_at
from storage.objects o
left join public.expediente_pdfs p on p.storage_path = o.name
where o.bucket_id = 'expediente-pdfs'
  and p.id is null
order by o.created_at;

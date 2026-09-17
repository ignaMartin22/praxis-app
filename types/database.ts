export type TipoDocumento = 'pdf' | 'docx' | 'jpg' | 'png';

export type ExpedientePdf = {
  id: string;
  expediente_id: string;
  tenant_id: string;
  storage_path: string;
  nombre_original: string;
  tipo_documento: TipoDocumento;
  tamano_bytes: number;
  creado_el: string;
};
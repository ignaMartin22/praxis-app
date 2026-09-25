export type TipoDocumento = 'pdf' | 'docx' | 'jpg' | 'png';

export type NotificationToken = {
  id: string;
  tenant_id: string;
  device_token: string;
  platform: 'android' | 'ios';
  creado_el: string;
};

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
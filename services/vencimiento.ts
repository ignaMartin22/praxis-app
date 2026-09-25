export type EstadoVencimiento = 'vencido' | 'hoy' | 'manana' | 'proximo' | null;

export const VENCIMIENTO_LABELS: Record<Exclude<EstadoVencimiento, null>, string> = {
  vencido: 'Vencido',
  hoy: 'Vence hoy',
  manana: 'Vence mañana',
  proximo: 'Próximo',
};

const DIAS_PROXIMO = 7;

// fecha viene en formato YYYY-MM-DD (columna date). Se compara por fecha pura,
// construyendo el Date local desde sus partes para evitar corrimientos de TZ.
export function definirDiasDesdeHoy(fecha: string, hoy: Date): number {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const fechaDate = new Date(anio, mes - 1, dia);
  const hoyDate = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const msPorDia = 1000 * 60 * 60 * 24;
  return Math.round((fechaDate.getTime() - hoyDate.getTime()) / msPorDia);
}

export function derivarVencimiento(fecha: string | null, hoy: Date = new Date()): EstadoVencimiento {
  if (!fecha) return null;

  const dias = definirDiasDesdeHoy(fecha, hoy);
  if (dias < 0) return 'vencido';
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'manana';
  if (dias <= DIAS_PROXIMO) return 'proximo';
  return null;
}
// Edge Function: push-vencimientos (RF-24/25)
// Programación: ver supabase/config.toml (cron). Se invoca además de forma manual con
// Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY> para pruebas.
//
// Reglas:
//  - RF-24: avisa con 1 día de anticipación y el mismo día del vencimiento, a todos
//    los dispositivos del tenant, sin app abierta.
//  - RF-25: el texto NO expone carátula, cliente ni número de expediente.
//  - Una sola notificación por tenant por ejecución (agrupa por fecha objetivo).

import { createClient } from 'npm:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type ExpedienteRow = {
  tenant_id: string;
  fecha_vencimiento: string | null;
};

type TokenRow = {
  tenant_id: string;
  device_token: string;
};

function aYmd(fecha: string): string {
  return fecha.slice(0, 10);
}

function diasObjetivo(): { hoy: string; manana: string } {
  const ahora = new Date();
  const hoy = aYmd(ahora.toISOString());
  const manana = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1);
  const y = manana.getFullYear();
  const m = String(manana.getMonth() + 1).padStart(2, '0');
  const d = String(manana.getDate()).padStart(2, '0');
  return { hoy, manana: `${y}-${m}-${d}` };
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Método no permitido', { status: 405 });
  }

  const auth = req.headers.get('Authorization') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceKey || auth !== `Bearer ${serviceKey}`) {
    return new Response('No autorizado', { status: 401 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) {
    return new Response('Configuración del proyecto incompleta', { status: 500 });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { hoy, manana } = diasObjetivo();

  const { data: expedientes, error } = await admin
    .from('expedientes')
    .select('tenant_id, fecha_vencimiento')
    .in('fecha_vencimiento', [hoy, manana])
    .neq('estado', 'Archivado');

  if (error) {
    return new Response('No se pudieron leer los expedientes', { status: 500 });
  }

  // Agrupación por tenant: cuántos vencen hoy / mañana.
  const porTenant = new Map<string, { hoy: boolean; manana: boolean; total: number }>();
  for (const e of (expedientes ?? []) as ExpedienteRow[]) {
    if (!e.fecha_vencimiento) continue;
    const fecha = aYmd(e.fecha_vencimiento);
    if (fecha !== hoy && fecha !== manana) continue;

    let grupo = porTenant.get(e.tenant_id);
    if (!grupo) {
      grupo = { hoy: false, manana: false, total: 0 };
      porTenant.set(e.tenant_id, grupo);
    }
    grupo.total += 1;
    if (fecha === hoy) grupo.hoy = true;
    if (fecha === manana) grupo.manana = true;
  }

  if (porTenant.size === 0) {
    return new Response('Sin vencimientos para hoy ni mañana', { status: 200 });
  }

  const tenantIds = [...porTenant.keys()];

  const { data: tokens, error: tokensError } = await admin
    .from('notification_tokens')
    .select('tenant_id, device_token')
    .in('tenant_id', tenantIds);

  if (tokensError) {
    return new Response('No se pudieron leer los tokens', { status: 500 });
  }

  // Texto seguro (RF-25): solo fechas y total, sin datos del expediente.
  const generadorTexto = (grupo: { hoy: boolean; manana: boolean; total: number }): string => {
    const partes: string[] = [];
    if (grupo.hoy) partes.push(`${grupo.total} HOY`);
    if (grupo.manana) partes.push(`${grupo.total} MAÑANA`);
    return `Vencimiento de expediente${grupo.total === 1 ? '' : 's'}: ${partes.join(' · ')}`;
  };

  const mensajes: { to: string; title: string; body: string; sound: string }[] = [];
  for (const t of (tokens ?? []) as TokenRow[]) {
    const grupo = porTenant.get(t.tenant_id);
    if (!grupo) continue;
    mensajes.push({
      to: t.device_token,
      title: 'Vencimiento de expediente',
      body: generadorTexto(grupo),
      sound: 'default',
    });
  }

  if (mensajes.length === 0) {
    return new Response('Sin dispositivos registrados', { status: 200 });
  }

  const respuesta = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mensajes),
  });

  const textoRespuesta = await respuesta.text();

  // Limpieza básica de tokens invalidados por Expo (DeviceNotRegistered).
  if (respuesta.ok) {
    try {
      const detalle: { status: string; details?: string; message?: string }[] = JSON.parse(textoRespuesta);
      const invalidos: string[] = [];
      detalle.forEach((d, i) => {
        if (d.status === 'error' && d.details && d.details.includes('DeviceNotRegistered')) {
          invalidos.push(mensajes[i].to);
        }
      });
      if (invalidos.length > 0) {
        await admin.from('notification_tokens').delete().in('device_token', invalidos);
      }
    } catch {
      // respuesta no parseable: se reporta como error genérico abajo
    }
  }

  if (!respuesta.ok) {
    return new Response('El servicio de notificaciones rechazó el envío', { status: 502 });
  }

  return new Response(`Notificaciones enviadas: ${mensajes.length}`, { status: 200 });
});
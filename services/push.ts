import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from '../supabase';
import { colors } from '../theme';

// Push remoto de vencimientos (RF-24). Los tokens se guardan por tenant en
// `notification_tokens`; la edge function `push-vencimientos` dispara los envíos.
// Nunca se guarda el token en AsyncStorage ni se expone el service role.
//
// Requerimientos reales para que el token exista:
//   - app.json debe tener `extra.eas.projectId` (proyecto de Expo/EAS).
//   - La app debe correr en un development build en un dispositivo físico:
//     desde SDK 53 Expo Go NO soporta push remotos.

export type EstadoPush = 'indeterminado' | 'otorgado' | 'denegado';

export type ResultadoRegistro = {
  ok: boolean;
  error: string | null;
};

let estadoActual: EstadoPush = 'indeterminado';
type Listener = (estado: EstadoPush) => void;
const listeners = new Set<Listener>();

export function getEstadoPush(): EstadoPush {
  return estadoActual;
}

export function suscribirEstadoPush(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function notificarEstado(estado: EstadoPush): void {
  estadoActual = estado;
  listeners.forEach((cb) => cb(estado));
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function traducirPermiso(permiso: Notifications.PermissionResponse): EstadoPush {
  if (permiso.granted || permiso.status === Notifications.PermissionStatus.GRANTED) return 'otorgado';
  if (permiso.canAskAgain) return 'indeterminado';
  return 'denegado';
}

export async function configurarPush(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('vencimientos', {
      name: 'Vencimientos',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: colors.gold,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
}

function obtenerProjectId(): string | null {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    null
  );
}

async function obtenerTokenExpo(): Promise<string | null> {
  const projectId = obtenerProjectId();
  if (!projectId) return null;

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch {
    return null;
  }
}

async function guardarTokenSiNuevo(tenantId: string): Promise<ResultadoRegistro> {
  const projectId = obtenerProjectId();
  if (!projectId) {
    return {
      ok: false,
      error: 'La app no tiene configurado su proyecto de notificaciones (extra.eas.projectId).',
    };
  }

  const token = await obtenerTokenExpo();
  if (!token) {
    return {
      ok: false,
      error: 'El dispositivo no generó un token push. Probá en un development build (Expo Go no soporta push).',
    };
  }

  const yaExiste = await supabase
    .from('notification_tokens')
    .select('device_token')
    .eq('tenant_id', tenantId)
    .eq('device_token', token)
    .maybeSingle();

  if (yaExiste.error) {
    return {
      ok: false,
      error: 'No se pudo verificar el token (revisá que la migración notification_tokens esté aplicada).',
    };
  }
  if (yaExiste.data) return { ok: true, error: null };

  const { error } = await supabase.from('notification_tokens').insert({
    tenant_id: tenantId,
    device_token: token,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
  });

  if (error) {
    return {
      ok: false,
      error: 'No se pudo guardar el token en la base de datos (revisá RLS y la migración notification_tokens).',
    };
  }

  return { ok: true, error: null };
}

// Al iniciar sesión: si aún no se preguntó, se pide una vez; si ya se otorgó,
// se registra el token. Nunca vuelve a preguntar tras un rechazo (banner lo cubre).
// Devuelve el estado y el detalle de un posible error de registro.
export async function sincronizarPushAlIniciar(tenantId: string): Promise<ResultadoRegistro> {
  if (!tenantId) return { ok: true, error: null };

  const permiso = await Notifications.getPermissionsAsync();
  const estado = traducirPermiso(permiso);

  if (estado === 'denegado') {
    notificarEstado('denegado');
    return { ok: true, error: null };
  }

  if (estado === 'otorgado') {
    notificarEstado('otorgado');
    return guardarTokenSiNuevo(tenantId);
  }

  // si aún no se preguntó: pedir una sola vez
  const pedido = await Notifications.requestPermissionsAsync();
  const estadoFinal = traducirPermiso(pedido);
  if (estadoFinal === 'otorgado') {
    notificarEstado('otorgado');
    return guardarTokenSiNuevo(tenantId);
  }

  notificarEstado('denegado');
  return { ok: true, error: null };
}

// Al volver a foreground: solo re-registrar el token si el permiso ya está dado;
// no se vuelve a pedir permiso por sistema (el banner orienta a Settings).
export async function sincronizarPushActivo(tenantId: string): Promise<void> {
  if (!tenantId) return;

  const permiso = await Notifications.getPermissionsAsync();
  const estado = traducirPermiso(permiso);
  if (estado === 'otorgado') {
    await guardarTokenSiNuevo(tenantId);
  }
}

export function useEstadoPush(): EstadoPush {
  const [estado, setEstado] = useState(getEstadoPush());

  useEffect(() => suscribirEstadoPush(setEstado), []);

  return estado;
}
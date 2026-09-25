import NetInfo from '@react-native-community/netinfo';

// Estado de conectividad global (RF-27/28). Suscribir una sola vez desde App.tsx.
type Listener = (online: boolean) => void;

let estadoActual = true;
let inicializado = false;
const listeners = new Set<Listener>();

export function getIsOnline(): boolean {
  return estadoActual;
}

export function suscribirOnline(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function initConnectividad(): void {
  if (inicializado) return;
  inicializado = true;

  NetInfo.addEventListener((state) => {
    const online = state.isConnected !== false && state.isInternetReachable !== false;
    if (online !== estadoActual) {
      estadoActual = online;
      listeners.forEach((cb) => cb(online));
    }
  });
}

// Guarda central de escrituras (RF-27): devuelve mensaje claro si no hay conexión.
export function requiereConexion(): string | null {
  if (estadoActual) return null;
  return 'No hay conexión a internet. Los cambios no se pueden guardar hasta que vuelvas a estar online.';
}
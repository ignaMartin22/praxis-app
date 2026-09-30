import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupportedStorage } from '@supabase/supabase-js';

// La sesión de Supabase puede superar el tamaño recomendado por valor de
// SecureStore, así que se guarda partida en trozos: `${key}.n` (cantidad) y `${key}.${i}`.
const CHUNK_SIZE = 1800;

const opciones: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

function claveCantidad(key: string) {
  return `${key}.n`;
}

function claveTrozo(key: string, indice: number) {
  return `${key}.${indice}`;
}

async function leerCantidad(key: string): Promise<number> {
  const valor = await SecureStore.getItemAsync(claveCantidad(key), opciones);
  const cantidad = valor ? Number.parseInt(valor, 10) : 0;
  return Number.isNaN(cantidad) ? 0 : cantidad;
}

async function borrarTrozos(key: string, desde: number, hasta: number) {
  for (let i = desde; i < hasta; i += 1) {
    await SecureStore.deleteItemAsync(claveTrozo(key, i), opciones);
  }
}

async function guardar(key: string, value: string) {
  const trozos: string[] = [];
  for (let i = 0; i < value.length; i += CHUNK_SIZE) {
    trozos.push(value.slice(i, i + CHUNK_SIZE));
  }

  const cantidadAnterior = await leerCantidad(key);
  for (let i = 0; i < trozos.length; i += 1) {
    await SecureStore.setItemAsync(claveTrozo(key, i), trozos[i], opciones);
  }
  await SecureStore.setItemAsync(claveCantidad(key), String(trozos.length), opciones);
  await borrarTrozos(key, trozos.length, cantidadAnterior);
}

async function leer(key: string): Promise<string | null> {
  const cantidad = await leerCantidad(key);
  if (cantidad === 0) return null;

  const trozos: string[] = [];
  for (let i = 0; i < cantidad; i += 1) {
    const trozo = await SecureStore.getItemAsync(claveTrozo(key, i), opciones);
    if (trozo === null) return null;
    trozos.push(trozo);
  }
  return trozos.join('');
}

export const secureSessionStorage: SupportedStorage = {
  async getItem(key) {
    try {
      const guardado = await leer(key);
      if (guardado !== null) return guardado;

      // Migración única: si la sesión quedó en AsyncStorage (versiones anteriores),
      // se mueve a SecureStore y se borra del almacenamiento plano.
      const anterior = await AsyncStorage.getItem(key);
      if (anterior === null) return null;
      await guardar(key, anterior);
      await AsyncStorage.removeItem(key);
      return anterior;
    } catch {
      return null;
    }
  },

  async setItem(key, value) {
    await guardar(key, value);
  },

  async removeItem(key) {
    const cantidad = await leerCantidad(key);
    await borrarTrozos(key, 0, cantidad);
    await SecureStore.deleteItemAsync(claveCantidad(key), opciones);
    await AsyncStorage.removeItem(key);
  },
};

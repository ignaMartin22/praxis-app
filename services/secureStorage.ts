import * as SecureStore from 'expo-secure-store';

// Adaptador de almacenamiento seguro (Keychain/Keystore) para Supabase.
// Cumple la regla 4 de la constitución y AGENTS.md: JAMÁS guardar la sesión en AsyncStorage.
export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
  },
};
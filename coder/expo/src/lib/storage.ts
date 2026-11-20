// Small key-value store for the session: the phone's secure store, or the browser's storage on the web build.
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export interface KV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

const webKV: KV = {
  async get(k) { try { return globalThis.localStorage ? globalThis.localStorage.getItem(k) : null; } catch { return null; } },
  async set(k, v) { try { globalThis.localStorage?.setItem(k, v); } catch { /* private mode */ } },
  async remove(k) { try { globalThis.localStorage?.removeItem(k); } catch { /* private mode */ } },
};

const nativeKV: KV = {
  get: (k) => SecureStore.getItemAsync(k),
  set: (k, v) => SecureStore.setItemAsync(k, v),
  remove: (k) => SecureStore.deleteItemAsync(k),
};

export const defaultKV: KV = Platform.OS === 'web' ? webKV : nativeKV;

/** A store kept in memory (tests). */
export function memoryKV(): KV & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    async get(k) { return k in data ? data[k] : null; },
    async set(k, v) { data[k] = v; },
    async remove(k) { delete data[k]; },
  };
}

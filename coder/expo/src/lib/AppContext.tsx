import { ActivityIndicator, View } from 'react-native';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createAuth, type Auth, type Session } from './auth';
import { createApi, type Api } from './api';

interface Ctx { auth: Auth; api: Api; session: Session | null; ready: boolean }
const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children, auth: given, api: givenApi }: { children: React.ReactNode; auth?: Auth; api?: Api }) {
  const auth = useMemo(() => given || createAuth(), [given]);
  const api = useMemo(() => givenApi || createApi(auth), [givenApi, auth]);
  const [session, setSession] = useState<Session | null>(auth.current());
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let on = true;
    const off = auth.onChange((s) => on && setSession(s));
    auth.load().then((s) => { if (on) { setSession(s); setReady(true); } });
    return () => { on = false; off(); };
  }, [auth]);
  // (Nothing calls Coder before the stored session is read: a chat opened from a link would be refused.)
  return (
    <AppCtx.Provider value={{ auth, api, session, ready }}>
      {ready ? children : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#faf9f7' }}><ActivityIndicator color="#0d1b2a" /></View>}
    </AppCtx.Provider>
  );
}

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp outside AppProvider');
  return c;
}

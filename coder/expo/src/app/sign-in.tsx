// SIGN IN WITH AN EMAILED CODE (no passwords, as on gofarther.dev): the email, then the code; a new email's first code makes its account.
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../lib/AppContext';
import { COLORS } from '../lib/config';
import { Logo } from '../components/Logo';
import { Button } from '../components/ui';
import type { AuthError } from '../lib/auth';

export default function SignIn() {
  const { auth } = useApp();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState('email');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);

  async function go() {
    if (busy) return;
    setMsg(null);
    if (step === 1 && !email.trim()) { setMsg({ text: 'Enter your email.' }); return; }
    setBusy(true);
    try {
      if (step === 2) {
        await auth.verifyCode(email, code, type);
        router.replace('/chats');
        return;
      }
      const r = await auth.sendCode(email);
      setType(r.type);
      setCode('');
      setStep(2);
    } catch (e) {
      const err = e as AuthError;
      if (err.restart) { setStep(1); setCode(''); }
      setMsg({ text: err.message || 'Something went wrong.' });
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    if (busy) return;
    setBusy(true); setMsg(null);
    try { const r = await auth.sendCode(email); setType(r.type); setCode(''); setMsg({ text: 'We sent a new code.', ok: true }); }
    catch (e) { setMsg({ text: (e as Error).message || 'Something went wrong.' }); }
    finally { setBusy(false); }
  }

  return (
    <SafeAreaView style={s.wrap}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.inner}>
        <View style={s.brand}><Logo size={72} /><Text style={s.name}>Coder</Text></View>
        <Text style={s.title}>{step === 2 ? 'Check your email' : 'Sign in'}</Text>
        <Text style={s.sub}>{step === 2 ? 'We sent a code to ' + email.trim() + '.' : 'We’ll email you a code. New here? The same code makes your account.'}</Text>
        {step === 1 ? (
          <TextInput testID="email" style={s.input} placeholder="you@example.com" autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress"
            value={email} onChangeText={setEmail} onSubmitEditing={go} returnKeyType="go" />
        ) : (
          <TextInput testID="code" style={[s.input, s.code]} placeholder="Code" keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode"
            value={code} onChangeText={setCode} onSubmitEditing={go} returnKeyType="go" maxLength={10} />
        )}
        {msg ? <Text style={[s.msg, msg.ok && { color: COLORS.ok }]}>{msg.text}</Text> : null}
        <Button testID="go" title={step === 2 ? 'Sign in' : 'Email me a code'} onPress={go} busy={busy} />
        {step === 2 ? (
          <View style={s.row}>
            <Button kind="plain" title="Use another email" onPress={() => { setStep(1); setCode(''); setMsg(null); }} />
            <Button kind="plain" title="Send a new code" onPress={resend} disabled={busy} />
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 12, maxWidth: 440, width: '100%', alignSelf: 'center' },
  brand: { alignItems: 'center', marginBottom: 18, gap: 6 },
  name: { fontSize: 22, fontWeight: '700', color: COLORS.ink },
  title: { fontSize: 26, fontWeight: '700', color: COLORS.ink },
  sub: { fontSize: 15, color: COLORS.muted, lineHeight: 21, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: COLORS.line, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: COLORS.ink },
  code: { letterSpacing: 6, fontSize: 20, textAlign: 'center' },
  msg: { color: COLORS.error, fontSize: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
});

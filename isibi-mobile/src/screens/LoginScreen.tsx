import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert,
} from "react-native";
import { C, F, R } from "../lib/theme";
import { login } from "../lib/api";

interface Props {
  onLogin: () => void;
}

export default function LoginScreen({ onLogin }: Props) {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Missing fields", "Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      onLogin();
    } catch (err: any) {
      Alert.alert("Login failed", err.message ?? "Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={s.inner}>
        {/* Logo mark */}
        <View style={s.logoWrap}>
          <View style={s.logoDot} />
        </View>

        <Text style={s.title}>ISIBI</Text>
        <Text style={s.sub}>Remote Command Center</Text>

        <View style={s.form}>
          <Text style={s.label}>Email</Text>
          <TextInput
            style={s.input}
            placeholder="you@example.com"
            placeholderTextColor={C.textDim}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={[s.label, { marginTop: 14 }]}>Password</Text>
          <TextInput
            style={s.input}
            placeholder="••••••••"
            placeholderTextColor={C.textDim}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[s.btn, loading && s.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.btnText}>Sign In</Text>
            }
          </TouchableOpacity>
        </View>

        <Text style={s.footer}>isibi.ai</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
    justifyContent: "center",
  },
  inner: {
    paddingHorizontal: 28,
    alignItems: "center",
  },
  logoWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: C.primaryL,
    borderWidth: 1,
    borderColor: C.primary + "55",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  logoDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.primary,
    opacity: 0.9,
  },
  title: {
    fontSize: F.xxl,
    fontWeight: "800",
    color: C.text,
    letterSpacing: 4,
  },
  sub: {
    fontSize: F.sm,
    color: C.textDim,
    marginTop: 4,
    marginBottom: 36,
    letterSpacing: 0.5,
  },
  form: {
    width: "100%",
    gap: 0,
  },
  label: {
    fontSize: F.xs,
    color: C.textMid,
    marginBottom: 6,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: F.md,
    color: C.text,
  },
  btn: {
    backgroundColor: C.primary,
    borderRadius: R.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 22,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: "#fff",
    fontSize: F.md,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  footer: {
    marginTop: 48,
    fontSize: F.xs,
    color: C.textDim,
    letterSpacing: 1,
  },
});

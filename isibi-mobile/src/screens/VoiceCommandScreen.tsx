import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import * as Speech from "expo-speech";
import { sendVoiceCommand, clearToken } from "../lib/api";
import { C, F, R } from "../lib/theme";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  time: string;
}

interface Props {
  onLogout: () => void;
}

const EXAMPLE_COMMANDS = [
  "How many calls today?",
  "List my agents",
  "Pause agent Mike",
  "Call John Smith",
  "Show my contacts",
];

export default function VoiceCommandScreen({ onLogout }: Props) {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const msgId = useRef(0);
  const scrollRef = useRef<ScrollView>(null);

  const pulse = Animated.loop(
    Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.25, duration: 600, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      Animated.timing(pulseAnim, { toValue: 1.0, duration: 600, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
    ])
  );

  function addMessage(role: "user" | "assistant", text: string) {
    const id = ++msgId.current;
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setMessages(prev => [...prev, { id, role, text, time }]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }

  async function startRecording() {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert("Microphone permission required");
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
      pulse.start();
    } catch (e) {
      Alert.alert("Could not start recording");
    }
  }

  async function stopRecording() {
    if (!recording) return;
    pulse.stop();
    pulseAnim.setValue(1);
    setIsRecording(false);
    setIsProcessing(true);

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (!uri) throw new Error("No audio recorded");

      // Upload to OpenAI Whisper for transcription
      const formData = new FormData();
      formData.append("file", { uri, type: "audio/m4a", name: "command.m4a" } as any);
      formData.append("model", "whisper-1");

      const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.EXPO_PUBLIC_OPENAI_KEY ?? ""}` },
        body: formData,
      });

      if (!whisperRes.ok) throw new Error("Transcription failed");
      const { text } = await whisperRes.json();
      if (!text?.trim()) {
        setIsProcessing(false);
        return;
      }

      addMessage("user", text.trim());
      await processCommand(text.trim());
    } catch (e: any) {
      setIsProcessing(false);
      Alert.alert("Error", e.message ?? "Something went wrong");
    }
  }

  async function processCommand(text: string) {
    try {
      const { result } = await sendVoiceCommand(text);
      setIsProcessing(false);

      // Check if it's a call initiation (JSON response)
      try {
        const parsed = JSON.parse(result);
        if (parsed.type === "initiate_call") {
          addMessage("assistant", parsed.message);
          Speech.speak(parsed.message, { language: "en" });
          return;
        }
      } catch {}

      addMessage("assistant", result);
      Speech.speak(result, { language: "en" });
    } catch (e: any) {
      setIsProcessing(false);
      const msg = e.message ?? "Command failed";
      addMessage("assistant", msg);
    }
  }

  async function sendTextCommand(text: string) {
    addMessage("user", text);
    setIsProcessing(true);
    await processCommand(text);
  }

  async function handleLogout() {
    await clearToken();
    onLogout();
  }

  return (
    <SafeAreaView style={s.container} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>isibi</Text>
          <Text style={s.subtitle}>Voice Command</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={s.logoutBtn}>
          <Text style={s.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {/* Message history */}
      <ScrollView
        ref={scrollRef}
        style={s.messages}
        contentContainerStyle={s.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 && (
          <View style={s.emptyState}>
            <Text style={s.emptyTitle}>What can I help you with?</Text>
            <Text style={s.emptySubtitle}>Hold the mic and speak, or tap an example below.</Text>
          </View>
        )}
        {messages.map(m => (
          <View key={m.id} style={[s.bubble, m.role === "user" ? s.bubbleUser : s.bubbleAssistant]}>
            <Text style={[s.bubbleText, m.role === "user" ? s.bubbleTextUser : s.bubbleTextAssistant]}>
              {m.text}
            </Text>
            <Text style={s.bubbleTime}>{m.time}</Text>
          </View>
        ))}
        {isProcessing && (
          <View style={[s.bubble, s.bubbleAssistant]}>
            <ActivityIndicator size="small" color={C.primary} />
          </View>
        )}
      </ScrollView>

      {/* Example commands */}
      {messages.length === 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.examples}
          contentContainerStyle={s.examplesContent}
        >
          {EXAMPLE_COMMANDS.map(cmd => (
            <TouchableOpacity
              key={cmd}
              style={s.exampleChip}
              onPress={() => sendTextCommand(cmd)}
              disabled={isProcessing || isRecording}
            >
              <Text style={s.exampleText}>{cmd}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Mic button */}
      <View style={s.micArea}>
        <Animated.View style={[s.micRing, isRecording && { transform: [{ scale: pulseAnim }] }]}>
          <TouchableOpacity
            style={[s.micBtn, isRecording && s.micBtnActive]}
            onPressIn={startRecording}
            onPressOut={stopRecording}
            disabled={isProcessing}
            activeOpacity={0.85}
          >
            {isProcessing
              ? <ActivityIndicator color="#fff" size="large" />
              : <Text style={s.micIcon}>{isRecording ? "🔴" : "🎙️"}</Text>
            }
          </TouchableOpacity>
        </Animated.View>
        <Text style={s.micHint}>
          {isRecording ? "Release to send" : isProcessing ? "Processing…" : "Hold to speak"}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:        { flex: 1, backgroundColor: C.bg },
  header:           { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  title:            { color: C.text, fontSize: F.xl, fontWeight: "700", letterSpacing: 1 },
  subtitle:         { color: C.textMid, fontSize: F.sm, marginTop: 1 },
  logoutBtn:        { paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.md, backgroundColor: C.white05 },
  logoutText:       { color: C.textMid, fontSize: F.sm },

  messages:         { flex: 1 },
  messagesContent:  { padding: 20, gap: 12, flexGrow: 1 },
  emptyState:       { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 60 },
  emptyTitle:       { color: C.text, fontSize: F.lg, fontWeight: "600", marginBottom: 8, textAlign: "center" },
  emptySubtitle:    { color: C.textMid, fontSize: F.sm, textAlign: "center", lineHeight: 20 },

  bubble:           { maxWidth: "80%", padding: 14, borderRadius: R.lg },
  bubbleUser:       { alignSelf: "flex-end", backgroundColor: C.primary },
  bubbleAssistant:  { alignSelf: "flex-start", backgroundColor: C.card2, borderWidth: 1, borderColor: C.border },
  bubbleText:       { fontSize: F.md, lineHeight: 22 },
  bubbleTextUser:   { color: "#fff" },
  bubbleTextAssistant: { color: C.text },
  bubbleTime:       { fontSize: F.xs, color: "rgba(255,255,255,0.4)", marginTop: 4, textAlign: "right" },

  examples:         { maxHeight: 50, marginBottom: 8 },
  examplesContent:  { paddingHorizontal: 20, gap: 8, alignItems: "center" },
  exampleChip:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border },
  exampleText:      { color: C.textMid, fontSize: F.sm },

  micArea:          { alignItems: "center", paddingBottom: 32, paddingTop: 20 },
  micRing:          { width: 110, height: 110, borderRadius: 55, backgroundColor: `${C.primary}22`, justifyContent: "center", alignItems: "center" },
  micBtn:           { width: 84, height: 84, borderRadius: 42, backgroundColor: C.primary, justifyContent: "center", alignItems: "center", shadowColor: C.primary, shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 0 }, elevation: 10 },
  micBtnActive:     { backgroundColor: "#9333ea" },
  micIcon:          { fontSize: 36 },
  micHint:          { color: C.textMid, fontSize: F.sm, marginTop: 12 },
});

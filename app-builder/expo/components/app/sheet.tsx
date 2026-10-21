import type { ReactNode } from "react";
import { Modal, Pressable, View } from "react-native";

/** A panel that slides up from the bottom over the screen — a basket, a confirmation, a choice. Tapping outside closes it. */
export function BottomSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/35" onPress={onClose} accessibilityLabel="Close" />
      <View className="gap-3 rounded-t-3xl bg-card p-5 pb-8">
        <View className="h-[5px] w-10 self-center rounded-full bg-line" />
        {children}
      </View>
    </Modal>
  );
}

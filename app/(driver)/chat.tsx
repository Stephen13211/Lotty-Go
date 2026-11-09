import Icon from "@react-native-vector-icons/material-design-icons";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/lib/auth";
import { listDriverChatMessages, sendDriverChatMessage } from "@/src/lib/driverChat";
import { colors, radius, spacing } from "@/src/theme";

export default function DriverChatScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const { data: messages = [], isLoading, error } = useQuery({
    queryKey: ["driver-community-chat"],
    queryFn: listDriverChatMessages,
    enabled: !!session,
    refetchInterval: 4000,
  });

  const send = async () => {
    if (!session || !draft.trim() || sending) return;
    setSending(true);
    try {
      await sendDriverChatMessage(session.user.id, draft);
      setDraft("");
      await queryClient.invalidateQueries({ queryKey: ["driver-community-chat"] });
    } catch (e: any) {
      Alert.alert("Message not sent", e?.message ?? "Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <View style={s.icon}><Icon name="account-group" size={25} color={colors.onBrandPrimary} /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Driver community</Text>
          <Text style={s.subtitle}>Chat with other approved Lotty Go drivers</Text>
        </View>
      </View>
      <View style={s.notice}>
        <Icon name="information-outline" size={18} color={colors.brandPrimary} />
        <Text style={s.noticeText}>Messages in this room are visible to all approved Lotty Go drivers. Keep conversations respectful and never post passwords, banking details or a rider's private information.</Text>
      </View>
      <ScrollView style={s.messages} contentContainerStyle={s.messageList}>
        {isLoading ? <ActivityIndicator color={colors.brandPrimary} /> : null}
        {error ? <Text style={s.empty}>Could not load messages. Check your connection and try again.</Text> : null}
        {!isLoading && !error && messages.length === 0 ? <Text style={s.empty}>No messages yet. Start the conversation with your fellow drivers.</Text> : null}
        {messages.map(item => {
          const mine = item.sender_id === session?.user.id;
          return (
            <View key={item.id} style={[s.message, mine ? s.mine : s.other]}>
              <Text style={s.sender}>{mine ? "You" : item.sender_name}</Text>
              <Text style={s.body}>{item.body}</Text>
              <Text style={s.time}>{new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
            </View>
          );
        })}
      </ScrollView>
      <View style={[s.composer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Message your fellow drivers…"
          placeholderTextColor={colors.muted}
          style={s.input}
          multiline
          maxLength={1000}
          editable={!sending}
        />
        <Pressable disabled={!draft.trim() || sending} onPress={send} style={[s.send, (!draft.trim() || sending) && { opacity: 0.45 }]}>
          {sending ? <ActivityIndicator color="#fff" /> : <Icon name="send" size={21} color="#fff" />}
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.divider },
  icon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 21, fontWeight: "900", color: colors.onSurface },
  subtitle: { fontSize: 12, color: colors.muted, marginTop: 3 },
  notice: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", margin: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md },
  noticeText: { flex: 1, color: colors.onSurface, fontSize: 12, lineHeight: 18 },
  messages: { flex: 1 },
  messageList: { padding: spacing.md, gap: spacing.sm, flexGrow: 1 },
  empty: { textAlign: "center", color: colors.muted, fontSize: 13, padding: spacing.xl, lineHeight: 20 },
  message: { maxWidth: "86%", padding: spacing.md, borderRadius: radius.md, gap: 4 },
  mine: { alignSelf: "flex-end", backgroundColor: colors.brandPrimary },
  other: { alignSelf: "flex-start", backgroundColor: colors.surfaceSecondary },
  sender: { fontSize: 11, fontWeight: "900", color: colors.onSurface },
  body: { color: colors.onSurface, fontSize: 14, lineHeight: 20 },
  time: { color: colors.muted, fontSize: 10, alignSelf: "flex-end" },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  input: { flex: 1, minHeight: 46, maxHeight: 120, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.onSurface, fontSize: 14 },
  send: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
});

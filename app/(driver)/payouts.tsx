import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/lib/auth";
import { getDriverProfile, type DriverProfile } from "@/src/lib/driver";
import { supabase } from "@/src/lib/supabase";
import { colors, radius, spacing } from "@/src/theme";

type Bank = { name: string; code: string; supported_types: string[] };

export default function DriverPayouts() {
  const insets = useSafeAreaInsets();
  const { session, configured } = useAuth();
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bank, setBank] = useState<Bank | null>(null);
  const [showBanks, setShowBanks] = useState(false);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountType, setAccountType] = useState<"personal" | "business">("personal");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session || !configured) { setLoading(false); return; }
    Promise.all([
      getDriverProfile(session.user.id),
      supabase.functions.invoke("paystack-driver-payout", { body: { action: "list_banks" } }),
    ]).then(([p, response]) => {
      setProfile(p);
      if (response.error) throw response.error;
      setBanks((response.data?.banks ?? []) as Bank[]);
    }).catch((e: any) => Alert.alert("Could not load payout setup", e?.message ?? "Please try again."))
      .finally(() => setLoading(false));
  }, [session?.user.id, configured]);

  const connected = profile?.payout_provider === "paystack" && !!profile?.payout_recipient_id;
  const submit = async () => {
    if (!session || !configured) return Alert.alert("Sign in required", "Please sign in first.");
    if (!profile || profile.application_status !== "approved") return Alert.alert("Approval required", "Your driver application must be approved before payout setup.");
    if (!bank) return Alert.alert("Choose your bank", "Select the bank linked to your account.");
    if (!/^\d{4,20}$/.test(accountNumber.replace(/\s/g, ""))) return Alert.alert("Check account number", "Enter a valid account number.");
    Alert.alert(
      "Confirm payout details",
      "Please make sure this is your own bank account and that the details are correct. Paystack may pay earnings to this account.",
      [
        { text: "Review again", style: "cancel" },
        { text: "Confirm and link", onPress: async () => {
          setSaving(true);
          try {
            const { data, error } = await supabase.functions.invoke("paystack-driver-payout", {
              body: { action: "create_subaccount", bank_code: bank.code, account_number: accountNumber.replace(/\s/g, ""), account_type: accountType },
            });
            if (error) throw error;
            if (data?.error) throw new Error(data.error);
            const updated = await getDriverProfile(session.user.id);
            setProfile(updated);
            setAccountNumber("");
            Alert.alert("Payout account submitted", data?.message ?? "Your payout account is pending verification.");
          } catch (e: any) {
            Alert.alert("Could not link bank account", e?.message ?? "Please try again.");
          } finally { setSaving(false); }
        } },
      ],
    );
  };

  return <ScrollView style={s.page} contentContainerStyle={{ padding: spacing.xl, paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}>
    <Text style={s.title}>Driver payouts</Text>
    <Text style={s.muted}>Link your South African bank account so eligible card-trip earnings can be settled directly to you.</Text>
    <View style={s.card}>
      <Text style={s.label}>LOTY GO DRIVER SHARE</Text>
      <Text style={s.share}>75% driver · 25% Lotty Go</Text>
      <Text style={s.muted}>The split is applied to eligible card payments. Paystack processing fees and final settlement timing are subject to your merchant agreement.</Text>
    </View>
    {loading ? <ActivityIndicator color={colors.brandPrimary}/> : !profile ? <Text style={s.muted}>Complete your driver application first.</Text> : profile.application_status !== "approved" ?
      <View style={s.notice}><Text style={s.noticeTitle}>Driver approval required</Text><Text style={s.muted}>Once your driver application is approved, you can securely link your bank account here.</Text></View> :
      connected ?
      <View style={s.notice}>
        <Text style={s.noticeTitle}>Bank account linked</Text>
        <Text style={s.muted}>Your Paystack subaccount reference is saved. Payout status: {(profile.payout_status ?? "pending").replace("_", " ")}.</Text>
        <Text style={s.muted}>Lotty Go will verify the payout details before enabling card-trip payouts. Contact support if you need to change your bank account.</Text>
      </View> :
      <>
        <View style={s.notice}><Text style={s.noticeTitle}>Your bank details stay protected</Text><Text style={s.muted}>Your account number is sent securely to Lotty Go's backend and Paystack. Lotty Go does not save the raw account number in your driver profile.</Text></View>
        <Text style={s.label}>BANK</Text>
        <Pressable style={s.select} onPress={() => setShowBanks(v => !v)}><Text style={{ color: bank ? colors.onSurface : colors.muted }}>{bank?.name ?? "Select your bank"}</Text><Text style={s.brand}>{showBanks ? "Close" : "Choose"}</Text></Pressable>
        {showBanks && <View style={s.bankList}>{banks.map(item => <Pressable key={item.code} onPress={() => { setBank(item); setShowBanks(false); }} style={s.bankItem}><Text style={s.bankText}>{item.name}</Text></Pressable>)}</View>}
        <Text style={s.label}>ACCOUNT TYPE</Text>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {(["personal", "business"] as const).map(type => <Pressable key={type} onPress={() => setAccountType(type)} style={[s.choice, accountType === type && s.choiceActive]}><Text style={{ color: colors.onSurface, fontWeight: "700" }}>{type === "personal" ? "Personal" : "Business"}</Text></Pressable>)}
        </View>
        <Text style={s.label}>BANK ACCOUNT NUMBER</Text>
        <TextInput value={accountNumber} onChangeText={setAccountNumber} keyboardType="number-pad" secureTextEntry style={s.input} placeholder="Enter account number" placeholderTextColor={colors.muted}/>
        <Pressable onPress={submit} disabled={saving} style={[s.button, saving && { opacity: 0.6 }]}>{saving ? <ActivityIndicator color="#fff"/> : <Text style={s.buttonText}>Securely link bank account</Text>}</Pressable>
      </>
    }
    <Text style={s.foot}>Never share your banking PIN, card PIN, password or one-time password with anyone, including Lotty Go support.</Text>
  </ScrollView>;
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface },
  title: { fontSize: 26, fontWeight: "900", color: colors.onSurface },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  label: { fontSize: 11, fontWeight: "900", color: colors.muted, letterSpacing: 1 },
  share: { fontSize: 20, fontWeight: "900", color: colors.onSurface, marginVertical: 6 },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.xs },
  notice: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  noticeTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "900" },
  select: { minHeight: 52, borderWidth: 1, borderColor: colors.divider, borderRadius: radius.md, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { color: colors.brandPrimary, fontWeight: "800" },
  bankList: { maxHeight: 240, borderWidth: 1, borderColor: colors.divider, borderRadius: radius.md },
  bankItem: { padding: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  bankText: { color: colors.onSurface, fontSize: 14 },
  choice: { flex: 1, minHeight: 46, borderWidth: 1, borderColor: colors.divider, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  choiceActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  input: { borderWidth: 1, borderColor: colors.divider, borderRadius: radius.md, minHeight: 52, paddingHorizontal: spacing.md, color: colors.onSurface, fontSize: 16 },
  button: { minHeight: 54, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  buttonText: { color: "#fff", fontWeight: "900", fontSize: 15 },
  foot: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: spacing.md },
});

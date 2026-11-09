import Icon from "@react-native-vector-icons/material-design-icons";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/lib/auth";
import { getDriverProfile } from "@/src/lib/driver";
import { colors, radius, spacing } from "@/src/theme";

type Bank = { name: string; code: string; supported_types?: string[] };
export default function BankPayoutSetup() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selected, setSelected] = useState<Bank | null>(null);
  const [search, setSearch] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountType, setAccountType] = useState<"personal" | "business">("personal");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string>("not_connected");
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [bankResult, profile] = await Promise.all([
          supabase.functions.invoke("paystack-driver-payout", { body: { action: "list_banks" } }),
          session ? getDriverProfile(session.user.id) : Promise.resolve(null),
        ]);
        if (bankResult.error) throw bankResult.error;
        if (alive) {
          setBanks(bankResult.data?.banks ?? []);
          setApproved(profile?.application_status === "approved");
          setStatus(profile?.payout_status ?? "not_connected");
        }
      } catch (e: any) {
        if (alive) Alert.alert("Could not load banks", e?.message ?? "Please try again.");
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [session?.user.id]);

  const filtered = useMemo(() => banks.filter(b => b.name.toLowerCase().includes(search.toLowerCase())), [banks, search]);
  const submit = async () => {
    if (!selected || !/^\d{4,20}$/.test(accountNumber.replace(/\s/g, ""))) {
      Alert.alert("Check bank details", "Choose your bank and enter a valid account number.");
      return;
    }
    Alert.alert(
      "Before you continue",
      "This sends the bank details to Paystack to create a driver subaccount. Only continue when Lotty Go has confirmed that your account is approved for South African test subaccounts and you are using test details.",
      [{ text: "Not now", style: "cancel" }, { text: "Continue", onPress: async () => {
        setSaving(true);
        try {
          const { data, error } = await supabase.functions.invoke("paystack-driver-payout", {
            body: { action: "create_subaccount", bank_code: selected.code, account_number: accountNumber.replace(/\s/g, ""), account_type: accountType },
          });
          if (error) throw error;
          setStatus(data?.payout_status ?? "pending");
          Alert.alert("Request submitted", data?.message ?? "Paystack returned a payout setup response.");
        } catch (e: any) {
          Alert.alert("Payout setup failed", e?.message ?? "Please try again.");
        } finally { setSaving(false); }
      }}],
    );
  };

  return <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ padding: spacing.xl, paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}>
    <Text style={s.title}>Bank payout setup</Text>
    <Text style={s.muted}>Link the bank account where your driver earnings should be settled.</Text>
    <View style={s.status}>
      <Icon name="shield-check-outline" size={22} color={colors.brandPrimary}/>
      <View style={{ flex: 1 }}>
        <Text style={s.statusTitle}>Payout status: {status.replace("_", " ")}</Text>
        <Text style={s.muted}>Card split: 75% driver · 25% Lotty Go. Cash rides remain 100% yours.</Text>
      </View>
    </View>
    {!approved ? <View style={s.warning}><Text style={s.warningText}>Your driver application must be approved before you can link a payout account.</Text></View> : null}
    <Text style={s.label}>BANK</Text>
    <TextInput value={search} onChangeText={setSearch} placeholder="Search South African banks" placeholderTextColor={colors.muted} style={s.input}/>
    {loading ? <ActivityIndicator color={colors.brandPrimary}/> : <View style={s.bankList}>
      {filtered.slice(0, 30).map(bank => <Pressable key={bank.code} onPress={() => setSelected(bank)} style={[s.bank, selected?.code === bank.code && s.bankSelected]}>
        <Text style={s.bankText}>{bank.name}</Text>
        {selected?.code === bank.code ? <Icon name="check-circle" color={colors.brandPrimary} size={20}/> : null}
      </Pressable>)}
      {!filtered.length ? <Text style={s.muted}>No matching bank found.</Text> : null}
    </View>}
    {selected ? <Text style={s.selected}>Selected: {selected.name}</Text> : null}
    <Text style={s.label}>ACCOUNT TYPE</Text>
    <View style={{ flexDirection: "row", gap: spacing.sm }}>
      {(["personal", "business"] as const).map(type => <Pressable key={type} onPress={() => setAccountType(type)} style={[s.type, accountType === type && s.typeActive]}><Text style={{ color: colors.onSurface, fontWeight: "800" }}>{type === "personal" ? "Personal" : "Business"}</Text></Pressable>)}
    </View>
    <Text style={s.label}>ACCOUNT NUMBER</Text>
    <TextInput value={accountNumber} onChangeText={setAccountNumber} keyboardType="number-pad" placeholder="Enter account number" placeholderTextColor={colors.muted} style={s.input} secureTextEntry/>
    <Text style={s.muted}>Your full account number is sent securely to the Paystack Edge Function and is not stored in the Lotty Go app.</Text>
    <Pressable disabled={!approved || saving || loading || !selected || !accountNumber} onPress={submit} style={[s.button, (!approved || saving || !selected || !accountNumber) && { opacity: 0.45 }]}>
      {saving ? <ActivityIndicator color="#fff"/> : <Text style={s.buttonText}>Connect bank account</Text>}
    </Pressable>
    <Text style={s.disclaimer}>Do not enter real bank details until Paystack confirms that your South African Starter Business account can create ZAR driver subaccounts in test mode. A pending status is not proof that payouts are active.</Text>
  </ScrollView>;
}
const s = StyleSheet.create({
  title:{fontSize:28,fontWeight:"900",color:colors.onSurface}, muted:{fontSize:12,color:colors.muted,lineHeight:18}, label:{fontSize:11,fontWeight:"900",letterSpacing:1,color:colors.muted,marginTop:spacing.sm},
  status:{flexDirection:"row",alignItems:"center",gap:spacing.md,padding:spacing.md,borderRadius:radius.md,backgroundColor:colors.brandTertiary},
  statusTitle:{fontSize:14,fontWeight:"900",color:colors.onBrandTertiary,textTransform:"capitalize"},
  warning:{padding:spacing.md,borderRadius:radius.md,backgroundColor:colors.surfaceSecondary,borderWidth:1,borderColor:colors.border},warningText:{fontSize:13,color:colors.onSurface,fontWeight:"700"},
  input:{minHeight:48,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,paddingHorizontal:spacing.md,color:colors.onSurface},
  bankList:{maxHeight:260,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,overflow:"hidden"},
  bank:{minHeight:44,paddingHorizontal:spacing.md,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},
  bankSelected:{backgroundColor:colors.brandTertiary},bankText:{fontSize:13,color:colors.onSurface,fontWeight:"600"},selected:{fontSize:12,color:colors.brandPrimary,fontWeight:"800"},
  type:{flex:1,minHeight:44,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:colors.border,borderRadius:radius.md},typeActive:{borderColor:colors.brandPrimary,backgroundColor:colors.brandTertiary},
  button:{minHeight:52,borderRadius:radius.pill,backgroundColor:colors.brandPrimary,alignItems:"center",justifyContent:"center",marginTop:spacing.sm},buttonText:{color:"#fff",fontWeight:"900",fontSize:15},
  disclaimer:{fontSize:11,color:colors.muted,lineHeight:17}
});

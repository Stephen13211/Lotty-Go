import Icon from "@react-native-vector-icons/material-design-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/lib/auth";
import { colors, radius, spacing } from "@/src/theme";

function Item({ icon, title, detail, onPress }: { icon: string; title: string; detail: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={s.item}>
    <View style={s.icon}><Icon name={icon as any} size={22} color={colors.brandPrimary} /></View>
    <View style={{ flex: 1, gap: 3 }}><Text style={s.itemTitle}>{title}</Text><Text style={s.detail}>{detail}</Text></View>
    <Icon name="chevron-right" size={22} color={colors.muted} />
  </Pressable>;
}

export default function Settings() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { role, session, signOut } = useAuth();
  const isAdmin = session?.user?.app_metadata?.role === "admin";
  const driver = role === "driver";
  return <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ padding: spacing.xl, paddingTop: insets.top + spacing.lg, gap: spacing.lg }}>
    <Text style={s.title}>Settings</Text>
    <Text style={s.subtitle}>Manage your Lotty Go account and preferences.</Text>
    <View style={s.group}>
      <Text style={s.heading}>ACCOUNT</Text>
      <Item icon="account-outline" title="Account details" detail={session?.user?.email ?? "Your profile"} onPress={() => router.push(driver ? "/(driver)/profile" : "/(rider)/profile")} />
      <Item icon="shield-check-outline" title="Safety and privacy" detail="Your safety on every trip" onPress={() => router.push({ pathname: "/settings-detail", params: { section: "safety" } })} />
      <Item icon="account-heart-outline" title="Trusted emergency contact" detail="Save someone to contact in an emergency" onPress={() => router.push("/safety-contacts")} />
    </View>
    {driver ? <View style={s.group}>
      <Text style={s.heading}>DRIVER</Text>
      <Item icon="file-document-outline" title="Driver application" detail="Documents, vehicle and approval status" onPress={() => router.push("/driver-application")} />
      <Item icon="bank-outline" title="Bank payout setup" detail="Secure payout-provider verification required" onPress={() => router.push("/bank-payout")} />
      <Item icon="account-heart-outline" title="Lotty Women preference" detail="Switch optional Lotty Women trips on or off after approval" onPress={() => router.push("/driver-application")} />
    </View> : <View style={s.group}>
      <Text style={s.heading}>RIDING</Text>
      <Item icon="credit-card-outline" title="Payment methods" detail="Cash is available; card payments are not connected yet" onPress={() => router.push({ pathname: "/settings-detail", params: { section: "payment" } })} />
      <Item icon="map-marker-outline" title="Saved places" detail="Manage home and work locations" onPress={() => router.push({ pathname: "/settings-detail", params: { section: "saved" } })} />
    </View>}
    {isAdmin ? <View style={s.group}><Text style={s.heading}>ADMINISTRATION</Text><Item icon="clipboard-check-outline" title="Driver approvals" detail="Review and approve driver applications" onPress={() => router.push("/admin-review")} /><Item icon="support-agent" title="Support and safety reports" detail="Review trip issues and emergency reports" onPress={() => router.push("/admin-support")} /><Item icon="cash-check" title="Cash commission settlements" detail="Track 25% commission received from drivers" onPress={() => router.push("/admin-settlements")} /><Item icon="timer-outline" title="Waiting fee settings" detail="Set the free period and per-minute charge" onPress={() => router.push("/admin-waiting-fees")} /></View> : null}
    <View style={s.group}>
      <Text style={s.heading}>SUPPORT</Text>
      <Item icon="help-circle-outline" title="Help and support" detail="Get help with your account or a trip" onPress={() => router.push("/report-issue")} />
      <Item icon="information-outline" title="About Lotty Go" detail="Version 1.0.0" onPress={() => router.push({ pathname: "/settings-detail", params: { section: "about" } })} />
    </View>
    <Pressable onPress={async () => { await signOut(); router.replace("/welcome"); }} style={s.logout}>
      <Icon name="logout" size={19} color={colors.error} /><Text style={{ color: colors.error, fontWeight: "800" }}>Log out</Text>
    </Pressable>
  </ScrollView>;
}
const s=StyleSheet.create({
 title:{fontSize:30,fontWeight:"900",color:colors.onSurface}, subtitle:{fontSize:14,color:colors.muted,marginTop:-spacing.md},
 group:{backgroundColor:colors.surfaceSecondary,borderRadius:radius.lg,paddingHorizontal:spacing.md,paddingVertical:spacing.sm},
 heading:{fontSize:11,fontWeight:"900",letterSpacing:1,color:colors.muted,padding:spacing.sm},
 item:{minHeight:66,flexDirection:"row",alignItems:"center",gap:spacing.md,padding:spacing.sm,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:colors.divider},
 icon:{width:40,height:40,borderRadius:radius.md,backgroundColor:colors.brandTertiary,alignItems:"center",justifyContent:"center"},
 itemTitle:{fontSize:14,fontWeight:"800",color:colors.onSurface},detail:{fontSize:11,color:colors.muted},
 logout:{minHeight:52,borderWidth:1,borderColor:colors.border,borderRadius:radius.pill,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:spacing.sm}
});

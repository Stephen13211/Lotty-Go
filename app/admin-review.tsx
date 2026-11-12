import Icon from "@react-native-vector-icons/material-design-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/lib/auth";
import { supabase } from "@/src/lib/supabase";
import { colors, radius, spacing } from "@/src/theme";

type Application = {
  user_id: string; legal_name: string | null; phone: string | null;
  vehicle_type: string | null; vehicle_make: string | null; vehicle_model: string | null;
  vehicle_year: number | null; vehicle_registration: string | null;
  application_status: string; women_riders_only: boolean; women_service_approved: boolean;
  created_at: string;
  payout_provider?: string | null; payout_recipient_id?: string | null; payout_status?: string;
};
type DriverDocument = {
  id: string; driver_id: string; document_type: string; storage_path: string;
  review_status: "pending" | "approved" | "rejected"; created_at: string;
};
const DOCUMENT_LABELS: Record<string, string> = {
  south_african_id: "South African ID",
  drivers_licence: "Driver's licence",
  prdp: "PrDP",
  vehicle_registration: "Vehicle registration",
  vehicle_roadworthy: "Roadworthy certificate",
  operating_licence: "Operating licence",
  police_clearance: "Police clearance / criminal-record report",
};
// Baseline documents Lotty Go expects to inspect before approving a driver.
// PrDP and operating licence are reviewed when applicable to that driver/service.
const REQUIRED_DOCUMENTS = [
  "south_african_id", "drivers_licence", "vehicle_registration",
  "vehicle_roadworthy", "police_clearance",
];

export default function AdminReview() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const { session } = useAuth();
  const isAdmin = session?.user?.app_metadata?.role === "admin";

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["admin-driver-applications"],
    queryFn: async () => {
      const { data, error } = await supabase.from("driver_profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Application[];
    },
    enabled: isAdmin,
  });
  const { data: documents = [], isLoading: docsLoading } = useQuery({
    queryKey: ["admin-driver-documents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("driver_documents").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as DriverDocument[];
    },
    enabled: isAdmin,
  });

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["admin-driver-applications"] });
    await qc.invalidateQueries({ queryKey: ["admin-driver-documents"] });
  };

  const openDocument = async (doc: DriverDocument) => {
    setBusy(doc.id);
    try {
      const { data, error } = await supabase.storage.from("driver-private-documents").createSignedUrl(doc.storage_path, 60);
      if (error) throw error;
      await Linking.openURL(data.signedUrl);
    } catch (e: any) {
      Alert.alert("Could not open document", e?.message ?? "Check that your admin account has private-bucket access.");
    } finally {
      setBusy(null);
    }
  };

  const reviewDocument = async (doc: DriverDocument, status: "approved" | "rejected") => {
    setBusy(doc.id);
    try {
      const { error } = await supabase.from("driver_documents")
        .update({ review_status: status, reviewed_at: new Date().toISOString() })
        .eq("id", doc.id);
      if (error) throw error;
      await refresh();
    } catch (e: any) {
      Alert.alert("Document review failed", e?.message ?? "Admin permission is required.");
    } finally {
      setBusy(null);
    }
  };

  const reviewPayout = async (row: Application, status: "verified" | "rejected") => {
    if (!row.payout_provider || !row.payout_recipient_id) {
      Alert.alert("No Paystack account", "This driver has not created a Paystack subaccount yet.");
      return;
    }
    Alert.alert(status === "verified" ? "Verify payout account?" : "Reject payout account?", status === "verified"
      ? "Only confirm after checking the Paystack subaccount and matching its bank-account name to the driver's verified identity."
      : "This will block card payments for this driver until payout details are corrected.", [
      { text: "Cancel", style: "cancel" },
      { text: status === "verified" ? "Verify account" : "Reject account", style: status === "rejected" ? "destructive" : "default", onPress: async () => {
        setBusy(row.user_id);
        try {
          const { error } = await supabase.from("driver_profiles").update({ payout_status: status, updated_at: new Date().toISOString() })
            .eq("user_id", row.user_id).eq("payout_provider", "paystack").not("payout_recipient_id", "is", null);
          if (error) throw error;
          await refresh();
          Alert.alert("Payout status updated", status === "verified" ? "This driver can now receive card-ride split payments." : "Card payments are blocked for this driver.");
        } catch (e: any) {
          Alert.alert("Could not update payout status", e?.message ?? "Admin permission is required.");
        } finally { setBusy(null); }
      }},
    ]);
  };

  const reviewApplication = async (row: Application, approved: boolean) => {
    const driverDocs = documents.filter(d => d.driver_id === row.user_id);
    const present = new Set(driverDocs.map(d => d.document_type));
    const missing = REQUIRED_DOCUMENTS.filter(type => !present.has(type));
    const unreviewed = driverDocs.filter(d => d.review_status !== "approved");
    if (approved && (missing.length > 0 || unreviewed.length > 0)) {
      const missingLabels = missing.map(type => DOCUMENT_LABELS[type]).join(", ");
      const pendingLabels = unreviewed.map(d => DOCUMENT_LABELS[d.document_type] ?? d.document_type).join(", ");
      Alert.alert(
        "Verification incomplete",
        [missing.length ? "Missing: " + missingLabels : "", unreviewed.length ? "Not approved: " + pendingLabels : ""].filter(Boolean).join("\n\n"),
      );
      return;
    }
    Alert.alert(
      approved ? "Approve driver?" : "Reject application?",
      approved ? "All baseline documents are present and marked approved. Confirm that you have checked the documents and vehicle details." : "This will mark the driver application as rejected.",
      [
        { text: "Cancel", style: "cancel" },
        { text: approved ? "Approve" : "Reject", style: approved ? "default" : "destructive", onPress: async () => {
          setBusy(row.user_id);
          try {
            const { error } = await supabase.from("driver_profiles")
              .update({ application_status: approved ? "approved" : "rejected", reviewed_at: new Date().toISOString() })
              .eq("user_id", row.user_id);
            if (error) throw error;
            await refresh();
            Alert.alert("Updated", approved ? "Driver approved." : "Application rejected.");
          } catch (e: any) {
            Alert.alert("Review failed", e?.message ?? "Admin permission is required.");
          } finally {
            setBusy(null);
          }
        }},
      ],
    );
  };

  const setWomenService = async (row: Application, enabled: boolean) => {
    setBusy(row.user_id);
    try {
      const { error } = await supabase.from("driver_profiles").update({ women_service_approved: enabled }).eq("user_id", row.user_id);
      if (error) throw error;
      await refresh();
      Alert.alert("Updated", enabled ? "Lotty Women service enabled for this driver." : "Lotty Women service disabled for this driver.");
    } catch (e: any) {
      Alert.alert("Update failed", e?.message ?? "Admin permission is required.");
    } finally {
      setBusy(null);
    }
  };

  if (!isAdmin) {
    return <View style={[s.center, { paddingTop: insets.top + spacing.xl }]}>
      <Icon name="lock-outline" size={34} color={colors.brandPrimary} />
      <Text style={s.title}>Admin access required</Text>
      <Text style={s.sub}>This screen is restricted to an account with the admin role in Supabase app metadata.</Text>
    </View>;
  }

  return <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ padding: spacing.xl, paddingTop: insets.top + spacing.lg, gap: spacing.md }}>
    <Text style={s.title}>Driver applications</Text>
    <Text style={s.sub}>Manually inspect each private document and the vehicle details before approving a driver.</Text>
    {isLoading || docsLoading ? <ActivityIndicator color={colors.brandPrimary} /> : error ? <Text style={s.sub}>Could not load applications: {(error as Error).message}</Text> : rows.length === 0 ? <Text style={s.sub}>No driver applications yet.</Text> : rows.map(row => {
      const driverDocs = documents.filter(d => d.driver_id === row.user_id);
      const present = new Set(driverDocs.map(d => d.document_type));
      const missing = REQUIRED_DOCUMENTS.filter(type => !present.has(type));
      const allApproved = missing.length === 0 && driverDocs.every(d => d.review_status === "approved");
      return <View key={row.user_id} style={s.card}>
        <View style={s.rowBetween}>
          <Text style={s.name}>{row.legal_name || "Driver applicant"}</Text>
          <Text style={s.status}>{row.application_status.toUpperCase()}</Text>
        </View>
        <Text style={s.sub}>{row.phone || "No phone"} · {row.vehicle_type === "motorcycle" ? "Motorcycle · Courier only" : row.vehicle_type === "car" ? "Car" : "Vehicle not selected"}</Text>
        <Text style={s.sub}>{[row.vehicle_year, row.vehicle_make, row.vehicle_model, row.vehicle_registration].filter(Boolean).join(" · ") || "Vehicle details incomplete"}</Text>
        <View style={{ padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface, gap: spacing.xs }}>
          <Text style={s.docName}>CARD PAYOUT ACCOUNT: {(row.payout_status ?? "not_connected").toUpperCase()}</Text>
          <Text style={s.sub}>{row.payout_provider === "paystack" && row.payout_recipient_id ? `Paystack subaccount: ${row.payout_recipient_id}` : "No Paystack subaccount linked"}</Text>
          {row.payout_status === "pending" && row.payout_recipient_id ? <View style={s.actions}>
            <Pressable disabled={!!busy} onPress={() => reviewPayout(row, "verified")} style={s.approve}><Text style={s.approveText}>Verify payout account</Text></Pressable>
            <Pressable disabled={!!busy} onPress={() => reviewPayout(row, "rejected")} style={s.reject}><Text style={s.rejectText}>Reject payout</Text></Pressable>
          </View> : null}
        </View>
        <Text style={s.section}>DOCUMENT CHECKLIST</Text>
        {driverDocs.length === 0 ? <Text style={s.sub}>No documents uploaded yet.</Text> : driverDocs.map(doc => (
          <View key={doc.id} style={s.document}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={s.docName}>{DOCUMENT_LABELS[doc.document_type] ?? doc.document_type}</Text>
              <Text style={[s.docStatus, doc.review_status === "approved" ? s.good : doc.review_status === "rejected" ? s.bad : s.waiting]}>{doc.review_status.toUpperCase()}</Text>
            </View>
            <Pressable disabled={!!busy} onPress={() => openDocument(doc)} style={s.smallButton}>
              {busy === doc.id ? <ActivityIndicator size="small" color={colors.brandPrimary} /> : <Text style={s.smallButtonText}>View</Text>}
            </Pressable>
            {doc.review_status !== "approved" ? <Pressable disabled={!!busy} onPress={() => reviewDocument(doc, "approved")} style={s.smallButton}><Text style={s.smallButtonText}>Approve</Text></Pressable> : null}
            {doc.review_status !== "rejected" ? <Pressable disabled={!!busy} onPress={() => reviewDocument(doc, "rejected")} style={s.rejectSmall}><Text style={s.rejectText}>Reject</Text></Pressable> : null}
          </View>
        ))}
        {missing.length > 0 ? <Text style={s.warning}>Missing baseline documents: {missing.map(type => DOCUMENT_LABELS[type]).join(", ")}</Text> : null}
        {row.women_riders_only ? <Text style={s.women}>Requests women riders only · Women-service approval: {row.women_service_approved ? "Yes" : "No"}</Text> : null}
        {row.application_status !== "approved" ? <View style={s.actions}>
          <Pressable disabled={!!busy || !allApproved} onPress={() => reviewApplication(row, true)} style={[s.approve, (!allApproved || !!busy) && s.disabled]}>
            <Text style={s.approveText}>Approve driver</Text>
          </Pressable>
          <Pressable disabled={!!busy} onPress={() => reviewApplication(row, false)} style={s.reject}>
            <Text style={s.rejectText}>Reject application</Text>
          </Pressable>
        </View> : <View style={{ gap: spacing.xs }}>
          {row.vehicle_type === "motorcycle" ? <Text style={s.sub}>Courier-only motorcycle drivers are not eligible for Lotty Women.</Text> : <><Text style={s.sub}>Lotty Women eligibility is reviewed separately from general driver approval.</Text>
          <Pressable disabled={!!busy} onPress={() => setWomenService(row, !row.women_service_approved)} style={s.womenButton}>
            <Text style={s.womenButtonText}>{row.women_service_approved ? "Disable Lotty Women" : "Approve for Lotty Women"}</Text>
          </Pressable></>}
        </View>}
      </View>;
    })}
    <View style={s.note}>
      <Icon name="shield-check-outline" size={20} color={colors.brandPrimary} />
      <Text style={s.sub}>Baseline checks: ID, driver's licence, vehicle registration, roadworthy certificate and police-clearance/criminal-record report. Review PrDP and operating licence when applicable. Open each document and compare it with the applicant and vehicle details before marking it approved.</Text>
    </View>
  </ScrollView>;
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  title: { fontSize: 28, fontWeight: "900", color: colors.onSurface },
  sub: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  card: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, gap: spacing.sm },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  name: { fontSize: 16, fontWeight: "900", color: colors.onSurface, flex: 1 },
  status: { fontSize: 10, fontWeight: "900", color: colors.brandPrimary },
  section: { fontSize: 10, fontWeight: "900", color: colors.muted, letterSpacing: 1, marginTop: spacing.xs },
  document: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingVertical: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  docName: { fontSize: 12, fontWeight: "800", color: colors.onSurface },
  docStatus: { fontSize: 9, fontWeight: "900" },
  good: { color: colors.success }, bad: { color: colors.error }, waiting: { color: colors.warning },
  smallButton: { minHeight: 34, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  smallButtonText: { fontSize: 10, fontWeight: "900", color: colors.brandPrimary },
  rejectSmall: { minHeight: 34, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.error, alignItems: "center", justifyContent: "center" },
  rejectText: { color: colors.error, fontSize: 11, fontWeight: "900" },
  warning: { color: colors.warning, fontSize: 11, lineHeight: 17, fontWeight: "700" },
  women: { fontSize: 11, color: colors.brandPrimary, fontWeight: "700" },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  approve: { flex: 1, minHeight: 42, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  approveText: { color: "#fff", fontWeight: "900", fontSize: 11 },
  disabled: { opacity: 0.35 },
  reject: { flex: 1, minHeight: 42, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.error, alignItems: "center", justifyContent: "center" },
  womenButton: { minHeight: 42, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  womenButtonText: { fontSize: 12, fontWeight: "900", color: colors.brandPrimary },
  note: { flexDirection: "row", gap: spacing.sm, padding: spacing.md, backgroundColor: colors.brandTertiary, borderRadius: radius.md },
});

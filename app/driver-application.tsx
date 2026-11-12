import Icon from "@react-native-vector-icons/material-design-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/lib/auth";
import { getDriverProfile, saveDriverApplication, setLottyWomenEnabled, type DriverProfile } from "@/src/lib/driver";
import { supabase } from "@/src/lib/supabase";
import { colors, radius, spacing } from "@/src/theme";

const DOCUMENTS = [
  { type: "south_african_id", label: "South African ID" },
  { type: "drivers_licence", label: "Driver's licence" },
  { type: "prdp", label: "PrDP (where required)" },
  { type: "vehicle_registration", label: "Vehicle registration" },
  { type: "vehicle_roadworthy", label: "Vehicle roadworthy documents" },
  { type: "operating_licence", label: "Operating licence (where required)" },
  { type: "police_clearance", label: "Police clearance / criminal-record check" },
] as const;
type DocumentType = (typeof DOCUMENTS)[number]["type"];

function Field({ label, value, onChangeText, placeholder, keyboardType }: any) {
  return <View style={{ gap:  6 }}><Text style={s.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.muted} keyboardType={keyboardType} style={s.input} /></View>;
}
export default function DriverApplication() {
  const insets = useSafeAreaInsets();
  const { session, configured } = useAuth();
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<DocumentType | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<Partial<Record<DocumentType, string>>>({});
  const [legalName, setLegalName] = useState(session?.user.user_metadata?.full_name ?? "");
  const [phone, setPhone] = useState("");
  const [vehicleType, setVehicleType] = useState<"car" | "motorcycle">("car");
  const [make, setMake] = useState(""); const [model, setModel] = useState(""); const [year, setYear] = useState(""); const [registration, setRegistration] = useState("");
  const [womenServiceEnabled, setWomenServiceEnabled] = useState(false);

  useEffect(() => {
    if (!session) { setLoading(false); return; }
    getDriverProfile(session.user.id).then(p => {
      setProfile(p);
      if (p) { setPhotoUrl(p.profile_photo_url ?? null); setLegalName(p.legal_name ?? ""); setPhone(p.phone ?? ""); setVehicleType(p.vehicle_type ?? "car"); setMake(p.vehicle_make ?? ""); setModel(p.vehicle_model ?? ""); setYear(p.vehicle_year ? String(p.vehicle_year) : ""); setRegistration(p.vehicle_registration ?? ""); setWomenServiceEnabled(!!p.women_service_enabled); }
    }).catch(e => Alert.alert("Could not load application", e.message)).finally(() => setLoading(false));
  }, [session?.user.id]);

  const uploadDocument = async (documentType: DocumentType, label: string) => {
    if (!session || !configured) { Alert.alert("Sign in required", "Please sign in and connect Supabase first."); return; }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/jpeg", "image/png"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (asset.size && asset.size > 10 * 1024 * 1024) {
        Alert.alert("File too large", "Please choose a document smaller than 10 MB.");
        return;
      }
      setUploading(documentType);
      const safeName = asset.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${session.user.id}/${documentType}/${Date.now()}-${safeName}`;
      const fileResponse = await fetch(asset.uri);
      const fileBlob = await fileResponse.blob();
      const { error: storageError } = await supabase.storage
        .from("driver-private-documents")
        .upload(storagePath, fileBlob, { contentType: asset.mimeType ?? "application/octet-stream", upsert: false });
      if (storageError) throw storageError;
      const { error: metadataError } = await supabase.from("driver_documents").insert({
        driver_id: session.user.id,
        document_type: documentType,
        storage_path: storagePath,
      });
      if (metadataError) {
        await supabase.storage.from("driver-private-documents").remove([storagePath]);
        throw metadataError;
      }
      setUploaded(previous => ({ ...previous, [documentType]: asset.name }));
      Alert.alert("Document uploaded", `${label} was uploaded securely.`);
    } catch (error: any) {
      Alert.alert("Upload failed", error?.message ?? "Please try again.");
    } finally {
      setUploading(null);
    }
  };

  const uploadProfilePhoto = async () => {
    if (!session || !configured) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["image/jpeg", "image/png"], copyToCacheDirectory: true, multiple: false });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (asset.size && asset.size > 5 * 1024 * 1024) { Alert.alert("Image too large", "Choose an image smaller than 5 MB."); return; }
      setPhotoUploading(true);
      const path = `${session.user.id}/profile-${Date.now()}.jpg`;
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const { error } = await supabase.storage.from("driver-profile-photos").upload(path, blob, { contentType: asset.mimeType ?? "image/jpeg", upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("driver-profile-photos").getPublicUrl(path);
      const { error: saveError } = await supabase.rpc("set_driver_profile_photo", { p_photo_url: data.publicUrl });
      if (saveError) throw saveError;
      setPhotoUrl(data.publicUrl);
      Alert.alert("Photo updated", "Your driver profile photo is saved.");
    } catch (e: any) { Alert.alert("Photo upload failed", e?.message ?? "Please try again."); }
    finally { setPhotoUploading(false); }
  };

  const submit = async () => {
    if (!session || !configured) { Alert.alert("Sign in required", "Please sign in and connect Supabase first."); return; }
    if (!legalName.trim() || !phone.trim() || !make.trim() || !model.trim() || !registration.trim()) { Alert.alert("Missing details", "Please complete your name, phone and vehicle details."); return; }
    setSaving(true);
    try {
      if (profile?.application_status === "approved") {
        if (!profile.women_service_approved) {
          Alert.alert("Lotty Women not approved", "Your normal driver approval remains active. You can continue receiving standard rides and eligible courier requests.");
          return;
        }
        await setLottyWomenEnabled(womenServiceEnabled);
        setProfile({ ...profile, women_service_enabled: womenServiceEnabled });
        Alert.alert("Preference updated", womenServiceEnabled ? "You can now receive Lotty Women requests as well as normal eligible trips." : "Lotty Women requests are switched off. Normal eligible trips remain available.");
      } else {
        const saved = await saveDriverApplication({ user_id: session.user.id, legal_name: legalName.trim(), phone: phone.trim(), vehicle_type: vehicleType, vehicle_make: make.trim(), vehicle_model: model.trim(), vehicle_year: year ? Number(year) : null, vehicle_registration: registration.trim().toUpperCase() });
        setProfile(saved); Alert.alert("Application saved", "Your driver application is now pending review. You cannot go online until Lotty Go approves it.");
      }
    } catch (e: any) { Alert.alert("Could not save", e?.message ?? "Please try again."); }
    finally { setSaving(false); }
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.brandPrimary} /><Text style={s.muted}>Loading application…</Text></View>;
  const status = profile?.application_status ?? "not_started";
  return <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ padding: spacing.xl, paddingTop: insets.top + spacing.lg, gap: spacing.md }}>
    <Text style={s.title}>Driver application</Text>
    <Text style={s.muted}>Complete your details to apply to drive with Lotty Go.</Text>
    <View style={s.statusCard}><Text style={s.label}>APPLICATION STATUS</Text><Text style={s.status}>{status.replace("_", " ").toUpperCase()}</Text><Text style={s.muted}>{status === "approved" ? "Your driver profile is approved." : status === "pending" ? "Your application is waiting for review." : "Submit your details and required documents for review."}</Text></View>
    <View style={{ alignItems: "center", gap: spacing.sm }}>
      {photoUrl ? <Image source={{ uri: photoUrl }} style={{ width: 88, height: 88, borderRadius: 44 }} /> : <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }}><Icon name="account" size={42} color={colors.brandPrimary} /></View>}
      <Pressable onPress={uploadProfilePhoto} disabled={photoUploading} style={s.uploadButton}>
        {photoUploading ? <ActivityIndicator size="small" color={colors.brandPrimary} /> : <Text style={s.uploadText}>{photoUrl ? "Change profile photo" : "Add profile photo"}</Text>}
      </Pressable>
    </View>
    <Text style={s.section}>PERSONAL DETAILS</Text>
    <Field label="Full legal name" value={legalName} onChangeText={setLegalName} placeholder="As shown on your ID" />
    <Field label="Mobile number" value={phone} onChangeText={setPhone} placeholder="e.g. 082 123 4567" keyboardType="phone-pad" />
    <Text style={s.section}>VEHICLE TYPE</Text>
    <View style={{ flexDirection: "row", gap: spacing.sm }}>
      {(["car", "motorcycle"] as const).map(t => <Pressable key={t} onPress={() => setVehicleType(t)} style={[s.choice, vehicleType === t && s.choiceActive]}><Icon name={t === "car" ? "car" : "motorbike"} size={22} color={colors.onSurface} /><Text style={s.choiceText}>{t === "car" ? "Car" : "Motorcycle · Courier only"}</Text></Pressable>)}
    </View>
    <Text style={s.section}>VEHICLE DETAILS</Text>
    <Field label="Make" value={make} onChangeText={setMake} placeholder="Toyota" />
    <Field label="Model" value={model} onChangeText={setModel} placeholder="Corolla" />
    <Field label="Year" value={year} onChangeText={setYear} placeholder="2022" keyboardType="number-pad" />
    <Field label="Registration number" value={registration} onChangeText={setRegistration} placeholder="CA 123-456" />
    {vehicleType !== "motorcycle" ? (status === "approved" && profile?.women_service_approved ? <View style={s.preference}><View style={{ flex: 1, gap: 4 }}><Text style={s.itemTitle}>Lotty Women trips</Text><Text style={s.muted}>Optional: switch on to receive Lotty Women requests. You will still receive your normal eligible trips.</Text></View><Switch value={womenServiceEnabled} onValueChange={setWomenServiceEnabled} trackColor={{ true: colors.brandPrimary }} /></View> : <View style={s.preference}><View style={{ flex: 1, gap: 4 }}><Text style={s.itemTitle}>Lotty Women access</Text><Text style={s.muted}>{status === "approved" ? "This service has a separate approval process. Your normal driver access is not affected." : "Lotty Women is reviewed separately from your standard driver application. Not being approved for it will not prevent normal driving once your standard application is approved."}</Text></View></View>}
    ) : null}
    <Text style={s.section}>DOCUMENTS AND VERIFICATION</Text>
    {DOCUMENTS.map(doc => <View key={doc.type} style={s.doc}>
      <Icon name="file-document-outline" size={20} color={colors.brandPrimary} />
      <View style={{ flex: 1, gap: 3 }}><Text style={{ color: colors.onSurface, fontWeight: "700" }}>{doc.label}</Text><Text style={uploaded[doc.type] ? s.uploaded : s.pending}>{uploaded[doc.type] ? "UPLOADED" : "NOT UPLOADED"}</Text></View>
      <Pressable disabled={uploading !== null} onPress={() => uploadDocument(doc.type, doc.label)} style={s.uploadButton}>
        {uploading === doc.type ? <ActivityIndicator size="small" color={colors.brandPrimary} /> : <Text style={s.uploadText}>{uploaded[doc.type] ? "Replace" : "Upload"}</Text>}
      </Pressable>
    </View>)}
    <Text style={s.note}>Accepted formats: PDF, JPG and PNG. Maximum file size: 10 MB. Documents are stored in a private bucket and are not made public.</Text>
    <Pressable onPress={submit} disabled={saving || uploading !== null} style={[s.button, (saving || uploading !== null) && { opacity: 0.6 }]}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Save and submit application</Text>}</Pressable>
  </ScrollView>;
}
const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm }, title: { fontSize: 29, fontWeight: "900", color: colors.onSurface }, muted: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  statusCard: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.brandTertiary, gap: 5 }, status: { fontSize: 20, fontWeight: "900", color: colors.brandPrimary },
  section: { fontSize: 11, fontWeight: "900", letterSpacing: 1, color: colors.muted, marginTop: spacing.sm }, label: { fontSize: 12, fontWeight: "800", color: colors.onSurfaceSecondary },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, color: colors.onSurface, backgroundColor: colors.surfaceSecondary },
  choice: { flex: 1, minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm }, choiceActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary }, choiceText: { fontWeight: "800", color: colors.onSurface },
  preference: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md }, itemTitle: { fontWeight: "800", color: colors.onSurface },
  doc: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider, paddingVertical: spacing.xs }, pending: { fontSize: 9, fontWeight: "900", color: colors.warning }, uploaded: { fontSize: 9, fontWeight: "900", color: colors.brandPrimary },
  uploadButton: { minWidth: 70, minHeight: 36, borderRadius: radius.md, borderWidth: 1, borderColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.sm }, uploadText: { fontSize: 12, fontWeight: "800", color: colors.brandPrimary },
  note: { fontSize: 11, color: colors.muted, lineHeight: 17 }, button: { minHeight: 54, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", marginTop: spacing.md }, buttonText: { fontWeight: "900", color: "#fff", fontSize: 15 }
});
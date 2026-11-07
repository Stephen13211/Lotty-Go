import Icon from "@react-native-vector-icons/material-design-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/lib/auth";
import { getDriverProfile, saveDriverApplication, type DriverProfile } from "@/src/lib/driver";
import { colors, radius, spacing } from "@/src/theme";

function Field({ label, value, onChangeText, placeholder, keyboardType }: any) {
  return <View style={{ gap: 6 }}><Text style={s.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.muted} keyboardType={keyboardType} style={s.input} /></View>;
}
export default function DriverApplication() {
  const insets=useSafeAreaInsets();
  const { session, configured }=useAuth();
  const [profile,setProfile]=useState<DriverProfile|null>(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [legalName,setLegalName]=useState(session?.user.user_metadata?.full_name ?? "");
  const [phone,setPhone]=useState("");
  const [vehicleType,setVehicleType]=useState<"car"|"motorcycle">("car");
  const [make,setMake]=useState(""); const [model,setModel]=useState(""); const [year,setYear]=useState(""); const [registration,setRegistration]=useState("");
  const [womenOnly,setWomenOnly]=useState(false);

  useEffect(()=>{ if(!session) {setLoading(false);return;} getDriverProfile(session.user.id).then(p=>{setProfile(p);if(p){setLegalName(p.legal_name??"");setPhone(p.phone??"");setVehicleType(p.vehicle_type??"car");setMake(p.vehicle_make??"");setModel(p.vehicle_model??"");setYear(p.vehicle_year?String(p.vehicle_year):"");setRegistration(p.vehicle_registration??"");setWomenOnly(!!p.women_riders_only);}}).catch(e=>Alert.alert("Could not load application",e.message)).finally(()=>setLoading(false)); },[session?.user.id]);

  const submit=async()=>{
    if(!session||!configured){Alert.alert("Sign in required","Please sign in and connect Supabase first.");return;}
    if(!legalName.trim()||!phone.trim()||!make.trim()||!model.trim()||!registration.trim()){Alert.alert("Missing details","Please complete your name, phone and vehicle details.");return;}
    setSaving(true);
    try { const saved=await saveDriverApplication({user_id:session.user.id,legal_name:legalName.trim(),phone:phone.trim(),vehicle_type:vehicleType,vehicle_make:make.trim(),vehicle_model:model.trim(),vehicle_year:year?Number(year):null,vehicle_registration:registration.trim().toUpperCase(),women_riders_only:womenOnly});setProfile(saved);Alert.alert("Application saved","Your driver application is now pending review. You cannot go online until Lotty Go approves it."); }
    catch(e:any){Alert.alert("Could not save",e?.message??"Please try again.");}
    finally{setSaving(false);}
  };
  if(loading)return <View style={s.center}><ActivityIndicator color={colors.brandPrimary}/><Text style={s.muted}>Loading application…</Text></View>;
  const status=profile?.application_status??"not_started";
  return <ScrollView style={{flex:1,backgroundColor:colors.surface}} contentContainerStyle={{padding:spacing.xl,paddingTop:insets.top+spacing.lg,gap:spacing.md}}>
    <Text style={s.title}>Driver application</Text>
    <Text style={s.muted}>Complete your details to apply to drive with Lotty Go.</Text>
    <View style={s.statusCard}><Text style={s.label}>APPLICATION STATUS</Text><Text style={s.status}>{status.replace("_"," ").toUpperCase()}</Text><Text style={s.muted}>{status==="approved"?"Your driver profile is approved.":status==="pending"?"Your application is waiting for review.":"Submit your details and required documents for review."}</Text></View>
    <Text style={s.section}>PERSONAL DETAILS</Text>
    <Field label="Full legal name" value={legalName} onChangeText={setLegalName} placeholder="As shown on your ID"/>
    <Field label="Mobile number" value={phone} onChangeText={setPhone} placeholder="e.g. 082 123 4567" keyboardType="phone-pad"/>
    <Text style={s.section}>VEHICLE TYPE</Text>
    <View style={{flexDirection:"row",gap:spacing.sm}}>
      {(["car","motorcycle"] as const).map(t=><Pressable key={t} onPress={()=>setVehicleType(t)} style={[s.choice,vehicleType===t&&s.choiceActive]}><Icon name={t==="car"?"car":"motorbike"} size={22} color={colors.onSurface}/><Text style={s.choiceText}>{t==="car"?"Car":"Motorcycle"}</Text></Pressable>)}
    </View>
    <Text style={s.section}>VEHICLE DETAILS</Text>
    <Field label="Make" value={make} onChangeText={setMake} placeholder="Toyota"/>
    <Field label="Model" value={model} onChangeText={setModel} placeholder="Corolla"/>
    <Field label="Year" value={year} onChangeText={setYear} placeholder="2022" keyboardType="number-pad"/>
    <Field label="Registration number" value={registration} onChangeText={setRegistration} placeholder="CA 123-456"/>
    <View style={s.preference}><View style={{flex:1,gap:4}}><Text style={s.itemTitle}>Only accept women riders</Text><Text style={s.muted}>Your preference will be subject to Lotty Women eligibility and approval.</Text></View><Switch value={womenOnly} onValueChange={setWomenOnly} trackColor={{true:colors.brandPrimary}}/></View>
    <Text style={s.section}>DOCUMENTS AND VERIFICATION</Text>
    {["South African ID","Driver's licence","PrDP (where required)","Vehicle registration and roadworthy documents","Operating licence (where required)","Police clearance / criminal-record check"].map((label,i)=><View key={label} style={s.doc}><Icon name="file-document-outline" size={20} color={colors.brandPrimary}/><Text style={{flex:1,color:colors.onSurface,fontWeight:"700"}}>{label}</Text><Text style={s.pending}>TO SUBMIT</Text></View>)}
    <Text style={s.note}>Document upload and secure payout-provider verification will be enabled after the private upload and provider onboarding connections are configured. Do not send ID or bank details through chat.</Text>
    <Pressable onPress={submit} disabled={saving} style={[s.button,saving&&{opacity:.6}]}>{saving?<ActivityIndicator color="#fff"/>:<Text style={s.buttonText}>Save and submit application</Text>}</Pressable>
  </ScrollView>;
}
const s=StyleSheet.create({
 center:{flex:1,alignItems:"center",justifyContent:"center",gap:spacing.sm},title:{fontSize:29,fontWeight:"900",color:colors.onSurface},muted:{fontSize:12,color:colors.muted,lineHeight:18},
 statusCard:{padding:spacing.lg,borderRadius:radius.lg,backgroundColor:colors.brandTertiary,gap:5},status:{fontSize:20,fontWeight:"900",color:colors.brandPrimary},
 section:{fontSize:11,fontWeight:"900",letterSpacing:1,color:colors.muted,marginTop:spacing.sm},label:{fontSize:12,fontWeight:"800",color:colors.onSurfaceSecondary},
 input:{minHeight:48,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,paddingHorizontal:spacing.md,color:colors.onSurface,backgroundColor:colors.surfaceSecondary},
 choice:{flex:1,minHeight:52,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:spacing.sm},choiceActive:{borderColor:colors.brandPrimary,backgroundColor:colors.brandTertiary},choiceText:{fontWeight:"800",color:colors.onSurface},
 preference:{flexDirection:"row",alignItems:"center",gap:spacing.md,padding:spacing.md,backgroundColor:colors.surfaceSecondary,borderRadius:radius.md},itemTitle:{fontWeight:"800",color:colors.onSurface},
 doc:{minHeight:46,flexDirection:"row",alignItems:"center",gap:spacing.sm,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.divider},pending:{fontSize:9,fontWeight:"900",color:colors.warning},
 note:{fontSize:11,color:colors.muted,lineHeight:17},button:{minHeight:54,borderRadius:radius.pill,backgroundColor:colors.brandPrimary,alignItems:"center",justifyContent:"center",marginTop:spacing.md},buttonText:{fontWeight:"900",color:"#fff",fontSize:15}
});

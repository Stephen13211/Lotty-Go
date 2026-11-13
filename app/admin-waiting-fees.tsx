import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/lib/auth";
import { colors, radius, spacing } from "@/src/theme";

export default function AdminWaitingFees() {
 const insets=useSafeAreaInsets(); const {session}=useAuth();
 const [free,setFree]=useState("2"); const [rate,setRate]=useState("2.00");
 const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false);
 useEffect(()=>{let live=true;(async()=>{const {data,error}=await supabase.from("platform_settings").select("waiting_free_minutes,waiting_fee_per_minute").eq("id",true).single();if(error){Alert.alert("Could not load settings",error.message);}else if(live){setFree(String(data.waiting_free_minutes));setRate(String(data.waiting_fee_per_minute));}setLoading(false);})();return()=>{live=false;};},[]);
 const save=async()=>{if(!session||session.user.app_metadata?.role!=="admin"){Alert.alert("Administrator access required");return;}const f=Number(free),r=Number(rate);if(!Number.isInteger(f)||f<0||f>30||!Number.isFinite(r)||r<0||r>100){Alert.alert("Invalid values","Free minutes must be 0–30 and fee must be R0–R100 per minute.");return;}setSaving(true);try{const {error}=await supabase.rpc("admin_set_waiting_fee",{p_free_minutes:f,p_fee_per_minute:r});if(error)throw error;Alert.alert("Saved","Waiting fee settings have been updated.");}catch(e:any){Alert.alert("Could not save",e?.message??"Please try again.");}finally{setSaving(false);}};
 if(loading)return <View style={s.center}><ActivityIndicator color={colors.brandPrimary}/></View>;
 return <View style={[s.page,{paddingTop:insets.top+spacing.lg}]}>
  <Text style={s.title}>Waiting fee settings</Text><Text style={s.muted}>Drivers must mark that they have arrived before the waiting timer starts. The server calculates the fee when the trip starts.</Text>
  <Text style={s.label}>FREE WAITING TIME (MINUTES)</Text><TextInput value={free} onChangeText={setFree} keyboardType="number-pad" style={s.input}/>
  <Text style={s.label}>WAITING FEE PER EXTRA MINUTE (ZAR)</Text><TextInput value={rate} onChangeText={setRate} keyboardType="decimal-pad" style={s.input}/>
  <Text style={s.note}>Current default: 2 free minutes, then R2 per additional minute (rounded up to each started minute). Changes apply to trips that have not started yet.</Text>
  <Pressable onPress={save} disabled={saving} style={s.button}>{saving?<ActivityIndicator color="#fff"/>:<Text style={s.buttonText}>Save waiting fee</Text>}</Pressable>
 </View>;
}
const s=StyleSheet.create({page:{flex:1,backgroundColor:colors.surface,padding:spacing.xl,gap:spacing.md},center:{flex:1,alignItems:"center",justifyContent:"center"},title:{fontSize:28,fontWeight:"900",color:colors.onSurface},muted:{fontSize:13,color:colors.muted,lineHeight:19},label:{fontSize:11,fontWeight:"900",color:colors.onSurfaceSecondary,marginTop:spacing.md},input:{minHeight:52,borderWidth:1,borderColor: "#39301B",borderRadius: radius.lg,paddingHorizontal:spacing.md,color:colors.onSurface,fontSize:17},note:{padding:spacing.md,backgroundColor:colors.brandTertiary,borderRadius: radius.lg,color:colors.onBrandTertiary,lineHeight:18},button:{minHeight:54,backgroundColor:colors.brandPrimary,borderRadius:radius.pill,alignItems:"center",justifyContent:"center",marginTop:spacing.lg},buttonText:{color:"#fff",fontWeight:"900",fontSize:15}});

import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/lib/auth";
import { supabase } from "@/src/lib/supabase";
import { colors, radius, spacing } from "@/src/theme";

const categories=[["trip_issue","Trip issue"],["driver_conduct","Driver conduct"],["rider_conduct","Rider conduct"],["fare_or_fee","Fare or fee"],["lost_item","Lost item"],["safety","Safety concern"],["other","Other"]];
export default function ReportIssue(){
 const insets=useSafeAreaInsets();const router=useRouter();const {rideId}=useLocalSearchParams<{rideId?:string}>();const {session}=useAuth();
 const [category,setCategory]=useState("trip_issue");const [details,setDetails]=useState("");const [busy,setBusy]=useState(false);
 const submit=async()=>{if(!session)return;if(details.trim().length<5){Alert.alert("Add details","Please describe the issue in at least five characters.");return;}setBusy(true);try{const {error}=await supabase.rpc("submit_ride_support_report",{p_ride_id:rideId??null,p_category:category,p_details:details.trim()});if(error)throw error;Alert.alert("Report submitted","Your report has been saved for the Lotty Go support team.",[{text:"OK",onPress:()=>router.back()}]);}catch(e:any){Alert.alert("Could not submit report",e?.message??"Please try again.");}finally{setBusy(false);}};
 return <ScrollView style={{flex:1,backgroundColor:colors.surface}} contentContainerStyle={{padding:spacing.xl,paddingTop:insets.top+spacing.lg,gap:spacing.md}}>
  <Text style={s.title}>Help and support</Text><Text style={s.sub}>Tell us what happened. Reports are visible to authorised Lotty Go administrators.</Text>
  <Text style={s.label}>WHAT IS THIS ABOUT?</Text>
  <View style={{gap:spacing.xs}}>{categories.map(([value,label])=><Pressable key={value} onPress={()=>setCategory(value)} style={[s.option,category===value&&s.selected]}><Text style={{color:category===value?colors.brandPrimary:colors.onSurface,fontWeight:"800"}}>{label}</Text></Pressable>)}</View>
  <Text style={s.label}>DETAILS</Text><TextInput value={details} onChangeText={setDetails} multiline maxLength={3000} placeholder="Describe the issue…" placeholderTextColor={colors.muted} style={s.textarea}/>
  <Pressable onPress={submit} disabled={busy} style={s.button}><Text style={s.buttonText}>{busy?"Submitting…":"Submit report"}</Text></Pressable>
 </ScrollView>;
}
const s=StyleSheet.create({title:{fontSize:28,fontWeight:"900",color:colors.onSurface},sub:{fontSize:13,color:colors.muted,lineHeight:19},label:{fontSize:11,fontWeight:"900",color:colors.onSurfaceSecondary,marginTop:spacing.md},option:{padding:spacing.md,borderWidth:1,borderColor:colors.border,borderRadius:radius.md},selected:{borderColor:colors.brandPrimary,backgroundColor:colors.brandTertiary},textarea:{minHeight:130,textAlignVertical:"top",borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.md,color:colors.onSurface},button:{minHeight:52,borderRadius:radius.pill,backgroundColor:colors.brandPrimary,alignItems:"center",justifyContent:"center",marginTop:spacing.lg},buttonText:{color:"#fff",fontWeight:"900"}});
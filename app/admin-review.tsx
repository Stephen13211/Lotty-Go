import Icon from "@react-native-vector-icons/material-design-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/lib/auth";
import { supabase } from "@/src/lib/supabase";
import { colors, radius, spacing } from "@/src/theme";

type Application={user_id:string;legal_name:string|null;phone:string|null;vehicle_type:string|null;vehicle_make:string|null;vehicle_model:string|null;vehicle_registration:string|null;application_status:string;women_riders_only:boolean;women_service_approved:boolean;created_at:string};
export default function AdminReview(){
 const insets=useSafeAreaInsets();const qc=useQueryClient();const [busy,setBusy]=useState<string|null>(null);const {session}=useAuth();
 const isAdmin=session?.user?.app_metadata?.role==="admin";
 const {data:rows=[],isLoading,error}=useQuery({queryKey:["admin-driver-applications"],queryFn:async()=>{const {data,error}=await supabase.from("driver_profiles").select("*").order("created_at",{ascending:false});if(error)throw error;return data as Application[];},enabled:isAdmin});
 const review=async(row:Application,approved:boolean)=>{
  setBusy(row.user_id);
  try{const {error}=await supabase.from("driver_profiles").update({application_status:approved?"approved":"rejected",reviewed_at:new Date().toISOString()}).eq("user_id",row.user_id);if(error)throw error;await qc.invalidateQueries({queryKey:["admin-driver-applications"]});Alert.alert("Updated",approved?"Driver approved.":"Application rejected.");}
  catch(e:any){Alert.alert("Review failed",e?.message??"Admin permission is required.");}
  finally{setBusy(null);}
 };
 const setWomenService=async(row:Application,enabled:boolean)=>{
  setBusy(row.user_id);
  try{const {error}=await supabase.from("driver_profiles").update({women_service_approved:enabled}).eq("user_id",row.user_id);if(error)throw error;await qc.invalidateQueries({queryKey:["admin-driver-applications"]});Alert.alert("Updated",enabled?"Lotty Women service enabled for this driver.":"Lotty Women service disabled for this driver.");}
  catch(e:any){Alert.alert("Update failed",e?.message??"Admin permission is required.");}
  finally{setBusy(null);}
 };
 return <ScrollView style={{flex:1,backgroundColor:colors.surface}} contentContainerStyle={{padding:spacing.xl,paddingTop:insets.top+spacing.lg,gap:spacing.md}}>
  <Text style={s.title}>Driver applications</Text><Text style={s.sub}>Admin-only review queue. Documents are stored in the private driver document bucket.</Text>
  {isLoading?<ActivityIndicator color={colors.brandPrimary}/>:error?<Text style={s.sub}>Could not load applications. Sign in with an account whose Supabase app_metadata role is admin.</Text>:rows.length===0?<Text style={s.sub}>No driver applications yet.</Text>:rows.map(row=><View key={row.user_id} style={s.card}>
   <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center"}}><Text style={s.name}>{row.legal_name||"Driver applicant"}</Text><Text style={s.status}>{row.application_status.toUpperCase()}</Text></View>
   <Text style={s.sub}>{row.phone||"No phone"} · {row.vehicle_type||"Vehicle not selected"}</Text>
   <Text style={s.sub}>{[row.vehicle_make,row.vehicle_model,row.vehicle_registration].filter(Boolean).join(" · ")||"Vehicle details incomplete"}</Text>
   {row.women_riders_only?<Text style={s.women}>Requests women riders only · Women-service approval: {row.women_service_approved?"Yes":"No"}</Text>:null}
   {row.application_status!=="approved"?<View style={{flexDirection:"row",gap:spacing.sm,marginTop:spacing.sm}}>
    <Pressable disabled={!!busy} onPress={()=>review(row,true)} style={[s.approve,!!busy&&{opacity:.5}]}>{busy===row.user_id?<ActivityIndicator color="#fff"/>:<Text style={s.approveText}>Approve driver</Text>}</Pressable>
    <Pressable disabled={!!busy} onPress={()=>review(row,false)} style={s.reject}><Text style={s.rejectText}>Reject</Text></Pressable>
   </View>:null}
   {row.application_status==="approved"?<View style={{gap:spacing.xs,marginTop:spacing.sm}}>
    <Text style={s.sub}>Lotty Women eligibility is reviewed separately from general driver approval.</Text>
    <Pressable disabled={!!busy} onPress={()=>setWomenService(row,!row.women_service_approved)} style={[s.womenButton,!!busy&&{opacity:.5}]}>
     <Text style={s.womenButtonText}>{row.women_service_approved?"Disable Lotty Women":"Approve for Lotty Women"}</Text>
    </Pressable>
   </View>:null}
  </View>)}
  <View style={s.note}><Icon name="lock-outline" size={20} color={colors.brandPrimary}/><Text style={s.sub}>Before approval, verify the required ID, licence, PrDP, vehicle documents and any applicable police-clearance or operating-licence requirements. This screen does not replace document verification.</Text></View>
 </ScrollView>;
}
const s=StyleSheet.create({title:{fontSize:28,fontWeight:"900",color:colors.onSurface},sub:{fontSize:12,color:colors.muted,lineHeight:18},card:{padding:spacing.lg,borderRadius:radius.lg,backgroundColor:colors.surfaceSecondary,gap:spacing.xs},name:{fontSize:16,fontWeight:"900",color:colors.onSurface,flex:1},status:{fontSize:10,fontWeight:"900",color:colors.brandPrimary},women:{fontSize:11,color:colors.brandPrimary,fontWeight:"700"},womenButton:{minHeight:42,borderRadius:radius.pill,borderWidth:1,borderColor:colors.brandPrimary,alignItems:"center",justifyContent:"center"},womenButtonText:{fontSize:12,fontWeight:"900",color:colors.brandPrimary},approve:{flex:1,minHeight:42,borderRadius:radius.pill,backgroundColor:colors.brandPrimary,alignItems:"center",justifyContent:"center"},approveText:{color:"#fff",fontWeight:"900"},reject:{flex:1,minHeight:42,borderRadius:radius.pill,borderWidth:1,borderColor:colors.error,alignItems:"center",justifyContent:"center"},rejectText:{color:colors.error,fontWeight:"900"},note:{flexDirection:"row",gap:spacing.sm,padding:spacing.md,backgroundColor:colors.brandTertiary,borderRadius:radius.md}});

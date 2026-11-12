import { useQuery,useQueryClient } from "@tanstack/react-query";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/lib/auth";
import { supabase } from "@/src/lib/supabase";
import { colors, radius, spacing } from "@/src/theme";

export default function AdminSupport(){
 const insets=useSafeAreaInsets();const {session}=useAuth();const qc=useQueryClient();const admin=session?.user.app_metadata?.role==="admin";
 const {data=[],isLoading,error}=useQuery({queryKey:["admin-support-reports"],enabled:admin,queryFn:async()=>{const {data,error}=await supabase.from("ride_support_reports").select("*").order("created_at",{ascending:false}).limit(100);if(error)throw error;return data;}});
 const update=async(id:string,status:string)=>{try{const {error}=await supabase.from("ride_support_reports").update({status,updated_at:new Date().toISOString(),resolved_at:status==="resolved"?new Date().toISOString():null}).eq("id",id);if(error)throw error;await qc.invalidateQueries({queryKey:["admin-support-reports"]});}catch(e:any){Alert.alert("Update failed",e?.message??"Please try again.");}};
 if(!admin)return <View style={s.center}><Text style={s.title}>Admin access required</Text></View>;
 return <ScrollView style={{flex:1,backgroundColor:colors.surface}} contentContainerStyle={{padding:spacing.xl,paddingTop:insets.top+spacing.lg,gap:spacing.md}}>
  <Text style={s.title}>Support and safety reports</Text>
  {isLoading?<ActivityIndicator color={colors.brandPrimary}/>:error?<Text style={s.sub}>Could not load reports: {(error as Error).message}</Text>:data.length===0?<Text style={s.sub}>No reports have been submitted.</Text>:data.map((r:any)=><View key={r.id} style={s.card}>
   <View style={{flexDirection:"row",justifyContent:"space-between"}}><Text style={s.category}>{r.category.replace(/_/g," ").toUpperCase()}</Text><Text style={[s.status,r.priority==="urgent"&&{color:colors.error}]}>{r.priority.toUpperCase()}</Text></View>
   <Text style={s.sub}>Status: {r.status} · {new Date(r.created_at).toLocaleString()}</Text><Text style={s.details}>{r.details}</Text><Text style={s.sub}>Report ID: {r.id}</Text>
   <View style={{flexDirection:"row",gap:spacing.sm,flexWrap:"wrap"}}>{["in_review","resolved","closed"].map(st=><Pressable key={st} onPress={()=>update(r.id,st)} style={s.action}><Text style={s.actionText}>{st.replace("_"," ")}</Text></Pressable>)}</View>
  </View>)}
 </ScrollView>;
}
const s=StyleSheet.create({center:{flex:1,alignItems:"center",justifyContent:"center"},title:{fontSize:27,fontWeight:"900",color:colors.onSurface},sub:{fontSize:12,color:colors.muted,lineHeight:18},card:{padding:spacing.md,borderRadius:radius.md,backgroundColor:colors.surfaceSecondary,gap:spacing.sm},category:{fontWeight:"900",color:colors.onSurface},status:{fontSize:10,fontWeight:"900",color:colors.brandPrimary},details:{color:colors.onSurface,lineHeight:20},action:{paddingHorizontal:spacing.md,paddingVertical:spacing.sm,borderRadius:radius.pill,borderWidth:1,borderColor:colors.brandPrimary},actionText:{color:colors.brandPrimary,fontWeight:"800",fontSize:11}});
import { useQuery,useQueryClient } from "@tanstack/react-query";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/lib/auth";
import { supabase } from "@/src/lib/supabase";
import { colors, radius, spacing } from "@/src/theme";
export default function AdminSettlements(){
 const insets=useSafeAreaInsets();const {session}=useAuth();const qc=useQueryClient();const admin=session?.user.app_metadata?.role==="admin";
 const {data=[],isLoading,error}=useQuery({queryKey:["admin-cash-settlements"],enabled:admin,queryFn:async()=>{const {data,error}=await supabase.from("payments").select("id,ride_id,rider_id,driver_id,total_fare,driver_share,lotty_share,lotty_settlement_status,paid_at").eq("payment_method","cash").eq("lotty_settlement_status","pending").order("created_at",{ascending:false});if(error)throw error;return data;}});
 const mark=async(id:string)=>{try{const {error}=await supabase.rpc("admin_mark_cash_commission_received",{p_payment_id:id});if(error)throw error;await qc.invalidateQueries({queryKey:["admin-cash-settlements"]});Alert.alert("Updated","Cash commission marked as received. This records an offline settlement; it does not transfer money.");}catch(e:any){Alert.alert("Could not update",e?.message??"Please try again.");}};
 if(!admin)return <View style={s.center}><Text style={s.title}>Admin access required</Text></View>;
 return <ScrollView style={{flex:1,backgroundColor:colors.surface}} contentContainerStyle={{padding:spacing.xl,paddingTop:insets.top+spacing.lg,gap:spacing.md}}>
  <Text style={s.title}>Cash commission settlements</Text><Text style={s.sub}>Drivers confirm cash received from riders. This queue tracks the 25% Lotty Go commission due for offline settlement.</Text>
  {isLoading?<ActivityIndicator color={colors.brandPrimary}/>:error?<Text style={s.sub}>Could not load settlements: {(error as Error).message}</Text>:data.length===0?<Text style={s.sub}>No cash commissions are currently outstanding.</Text>:data.map((p:any)=><View key={p.id} style={s.card}>
   <Text style={s.fare}>Ride total R{Number(p.total_fare).toFixed(2)}</Text><Text style={s.sub}>Driver 75%: R{Number(p.driver_share).toFixed(2)}</Text><Text style={s.due}>Lotty Go 25% due: R{Number(p.lotty_share).toFixed(2)}</Text><Text style={s.sub}>Ride: {p.ride_id}</Text>
   <Pressable onPress={()=>Alert.alert("Confirm offline settlement?","Only mark this received after Lotty Go has actually received the commission.",[{text:"Cancel",style:"cancel"},{text:"Mark received",onPress:()=>mark(p.id)}])} style={s.button}><Text style={s.buttonText}>Mark commission received</Text></Pressable>
  </View>)}
 </ScrollView>;
}
const s=StyleSheet.create({center:{flex:1,alignItems:"center",justifyContent:"center"},title:{fontSize:27,fontWeight:"900",color:colors.onSurface},sub:{fontSize:12,color:colors.muted,lineHeight:18},card:{padding:spacing.md,borderRadius:radius.md,backgroundColor:colors.surfaceSecondary,gap:spacing.sm},fare:{fontWeight:"900",fontSize:17,color:colors.onSurface},due:{fontWeight:"900",color:colors.error},button:{minHeight:44,borderRadius:radius.pill,backgroundColor:colors.brandPrimary,alignItems:"center",justifyContent:"center"},buttonText:{color:"#fff",fontWeight:"900"}});
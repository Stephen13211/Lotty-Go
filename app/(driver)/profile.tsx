import Icon from "@react-native-vector-icons/material-design-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/lib/auth";
import { colors, radius, spacing } from "@/src/theme";

export default function DriverProfile(){
 const insets=useSafeAreaInsets();const router=useRouter();const {session,setRole}=useAuth();
 const name=(session?.user?.user_metadata?.full_name as string)??session?.user?.email??"Driver";
 return <View style={{flex:1,backgroundColor:colors.surface,paddingTop:insets.top}}>
  <View style={{alignItems:"center",padding:spacing.xl,gap:spacing.sm}}>
   <View style={s.avatar}><Icon name="steering" size={38} color={colors.onBrandSecondary}/></View>
   <Text style={{fontSize:20,fontWeight:"800",color:colors.onSurface}}>{name}</Text><Text style={{fontSize:13,color:colors.muted}}>Driver · Lotty Go</Text>
  </View>
  <View style={s.group}>
   <Pressable style={s.row} onPress={()=>router.push("/driver-application")}><Icon name="file-document-outline" size={22} color={colors.brandPrimary}/><View style={{flex:1}}><Text style={s.rowTitle}>Driver application</Text><Text style={s.sub}>Documents, vehicle and approval status</Text></View><Icon name="chevron-right" size={20} color={colors.muted}/></Pressable>
   <Pressable style={s.row} onPress={()=>router.push("/bank-payout")}><Icon name="bank-outline" size={22} color={colors.brandPrimary}/><View style={{flex:1}}><Text style={s.rowTitle}>Payout details</Text><Text style={s.sub}>Link your bank account for driver earnings</Text></View><Icon name="chevron-right" size={20} color={colors.muted}/></Pressable>
   <Pressable style={s.row} onPress={()=>router.push("/settings")}><Icon name="cog-outline" size={22} color={colors.brandPrimary}/><View style={{flex:1}}><Text style={s.rowTitle}>Settings</Text><Text style={s.sub}>Preferences and account settings</Text></View><Icon name="chevron-right" size={20} color={colors.muted}/></Pressable>
  </View>
  <Pressable onPress={async()=>{await setRole("rider");router.replace("/(rider)");}} style={s.sw}><Icon name="map-marker-radius" size={18} color={colors.onBrandPrimary}/><Text style={{color:colors.onBrandPrimary,fontWeight:"700"}}>Switch to Rider</Text></Pressable>
 </View>;
}
const s=StyleSheet.create({avatar:{width:84,height:84,borderRadius:radius.pill,backgroundColor:colors.brandSecondary,alignItems:"center",justifyContent:"center"},group:{marginHorizontal:spacing.lg,backgroundColor:colors.surfaceSecondary,borderRadius:radius.md,overflow:"hidden"},row:{minHeight:66,padding:spacing.md,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.divider,flexDirection:"row",alignItems:"center",gap:spacing.md},rowTitle:{fontWeight:"800",color:colors.onSurface},sub:{fontSize:11,color:colors.muted},sw:{margin:spacing.lg,height:52,borderRadius:radius.pill,backgroundColor:colors.brandPrimary,alignItems:"center",justifyContent:"center",flexDirection:"row",gap:spacing.sm}});

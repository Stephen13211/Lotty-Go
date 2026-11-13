import Icon from "@react-native-vector-icons/material-design-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/lib/auth";
import { colors, radius, spacing } from "@/src/theme";

export default function Profile() {
 const insets=useSafeAreaInsets();const router=useRouter();const {session,setRole}=useAuth();
 const name=(session?.user?.user_metadata?.full_name as string)??session?.user?.email??"Guest";
 const rows=[["credit-card-outline","Payment methods","Cash and card options", "payment"],["map-marker-outline","Saved places","Home and work shortcuts","saved"],["shield-check-outline","Safety","Safety and privacy information","safety"],["cog-outline","Settings","Account preferences and support","settings"]];
 return <View style={{flex:1,backgroundColor:colors.surface,paddingTop:insets.top}}>
  <View style={{alignItems:"center",padding:spacing.xl,gap:spacing.sm}}>
   <LinearGradient colors={["#F9E27D", "#D4AF37", "#8C6A15"]} style={s.avatar}><Icon name="account" size={38} color={colors.onBrandPrimary}/></LinearGradient>
   <Text style={{fontSize:20,fontWeight:"800",color:colors.onSurface}}>{name}</Text><Text style={{fontSize:13,color:colors.muted}}>Rider · Lotty Go</Text>
  </View>
  <View style={s.sec}>{rows.map(([icon,label,desc,target])=><Pressable key={label} onPress={()=>router.push(target==="settings"?"/settings":{pathname:"/settings-detail",params:{section:target}})} style={s.row}>
   <Icon name={icon as any} size={21} color={colors.brandPrimary}/><View style={{flex:1}}><Text style={{color:colors.onSurface,fontWeight:"700"}}>{label}</Text><Text style={{color:colors.muted,fontSize:11}}>{desc}</Text></View><Icon name="chevron-right" size={20} color={colors.muted}/>
  </Pressable>)}</View>
  <Pressable onPress={async()=>{await setRole("driver");router.replace("/driver-application");}} style={s.switch}><Icon name="steering" size={18} color={colors.onBrandSecondary}/><Text style={{color:colors.onBrandSecondary,fontWeight:"700"}}>Become a Driver</Text></Pressable>
 </View>;
}
const s=StyleSheet.create({avatar:{width:84,height:84,borderRadius:radius.pill,backgroundColor:colors.brandPrimary,alignItems:"center",justifyContent:"center"},sec:{marginHorizontal:spacing.lg,backgroundColor:"#151517",borderRadius:radius.lg,borderWidth:1,borderColor:"#39301B",overflow:"hidden"},row:{minHeight:62,padding:spacing.md,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.divider,flexDirection:"row",alignItems:"center",gap:spacing.md},switch:{margin:spacing.lg,height:52,borderRadius:radius.pill,backgroundColor:"#282215",borderWidth:1,borderColor:"#806A30",alignItems:"center",justifyContent:"center",flexDirection:"row",gap:spacing.sm}});

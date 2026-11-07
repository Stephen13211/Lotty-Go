import Icon from "@react-native-vector-icons/material-design-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, spacing } from "@/src/theme";

const COPY: Record<string,{title:string;body:string;note:string}> = {
  payment:{title:"Payment methods",body:"Cash is available for rides. Card payments will be enabled when Lotty Go's approved payment gateway and payout provider are connected.",note:"No card details are collected or stored by this app at this stage."},
  saved:{title:"Saved places",body:"Home and work address shortcuts are planned for a future update.",note:"You can still search for any pickup or destination on the ride screen."},
  safety:{title:"Safety and privacy",body:"Driver verification, private document storage and trip safety tools are being prepared.",note:"Sensitive identity documents must only be uploaded through Lotty Go's private, authenticated document flow."},
  support:{title:"Help and support",body:"Support tools are being prepared for the Lotty Go launch.",note:"For now, use your existing Lotty Go project support channel."},
  about:{title:"About Lotty Go",body:"Lotty Go is a South African ride and motorcycle delivery platform in development.",note:"Version 1.0.0"},
};
export default function SettingsDetail(){
 const insets=useSafeAreaInsets();const router=useRouter();const {section}=useLocalSearchParams<{section?:string}>();
 const item=COPY[section??""]??COPY.about;
 return <ScrollView style={{flex:1,backgroundColor:colors.surface}} contentContainerStyle={{padding:spacing.xl,paddingTop:insets.top+spacing.lg,gap:spacing.lg}}>
  <Pressable onPress={()=>router.back()} style={s.back}><Icon name="arrow-left" size={22} color={colors.onSurface}/></Pressable>
  <Text style={s.title}>{item.title}</Text><Text style={s.body}>{item.body}</Text>
  <View style={s.card}><Icon name="information-outline" size={24} color={colors.brandPrimary}/><Text style={s.note}>{item.note}</Text></View>
 </ScrollView>;
}
const s=StyleSheet.create({back:{width:42,height:42,borderRadius:21,backgroundColor:colors.surfaceSecondary,alignItems:"center",justifyContent:"center"},title:{fontSize:28,fontWeight:"900",color:colors.onSurface},body:{fontSize:16,lineHeight:24,color:colors.onSurfaceSecondary},card:{padding:spacing.lg,borderRadius:radius.md,backgroundColor:colors.brandTertiary,flexDirection:"row",gap:spacing.md,alignItems:"flex-start"},note:{flex:1,color:colors.onBrandTertiary,lineHeight:20,fontSize:13}});

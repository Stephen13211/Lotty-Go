import Icon from "@react-native-vector-icons/material-design-icons";
import { useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, spacing } from "@/src/theme";

const COPY: Record<string,{title:string;body:string;note:string}> = {
  payment:{title:"Payment methods",body:"Cash is available for rides. Card payments will be enabled when Lotty Go's approved payment gateway and payout provider are connected.",note:"No card details are collected or stored by this app at this stage."},
  saved:{title:"Saved places",body:"Home and work address shortcuts are planned for a future update.",note:"You can still search for any pickup or destination on the ride screen."},
  safety:{title:"Safety and privacy",body:"Use the active-trip emergency button to call 112 in South Africa and save a trusted emergency contact in your account.",note:"Emergency contacts are stored for reference; Lotty Go does not automatically call or message them. For immediate danger, contact emergency services directly."},
  support:{title:"Help and support",body:"Submit a report about a trip, fare, lost item, conduct or safety concern.",note:"Reports are stored securely for authorised Lotty Go administrators to review."},
  about:{title:"About Lotty Go",body:"Lotty Go is a South African ride and motorcycle delivery platform in development.",note:"Version 1.0.0"},
};
export default function SettingsDetail(){
 const insets=useSafeAreaInsets();const {section}=useLocalSearchParams<{section?:string}>();
 const item=COPY[section??""]??COPY.about;
 return <ScrollView style={{flex:1,backgroundColor:colors.surface}} contentContainerStyle={{padding:spacing.xl,paddingTop:insets.top+spacing.lg,gap:spacing.lg}}>
  <Text style={s.title}>{item.title}</Text><Text style={s.body}>{item.body}</Text>
  <View style={s.card}><Icon name="information-outline" size={24} color={colors.brandPrimary}/><Text style={s.note}>{item.note}</Text></View>
 </ScrollView>;
}
const s=StyleSheet.create({title:{fontSize:28,fontWeight:"900",color:colors.onSurface},body:{fontSize:16,lineHeight:24,color:colors.onSurfaceSecondary},card:{padding:spacing.lg,borderRadius:radius.lg,borderWidth:1,borderColor:"#55451E",backgroundColor:"#1D180E",flexDirection:"row",gap:spacing.md,alignItems:"flex-start"},note:{flex:1,color:colors.onBrandTertiary,lineHeight:20,fontSize:13}});

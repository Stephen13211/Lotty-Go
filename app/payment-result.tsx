import Icon from "@react-native-vector-icons/material-design-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, spacing } from "@/src/theme";

export default function PaymentResult() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return <View style={[s.root, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
    <View style={s.icon}><Icon name="credit-card-check-outline" size={42} color={colors.brandPrimary}/></View>
    <Text style={s.title}>Returning to Lotty Go</Text>
    <Text style={s.body}>Paystack has returned you to the app. Your ride screen will show the payment status once our secure webhook confirms the transaction. Please don't pay again if the status is still updating.</Text>
    <Pressable onPress={() => router.replace("/(rider)/trips")} style={s.button}><Text style={s.buttonText}>Back to my ride</Text></Pressable>
  </View>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:colors.surface,alignItems:"center",justifyContent:"center",padding:spacing.xl,gap:spacing.lg},
 icon:{width:88,height:88,borderRadius:radius.pill,backgroundColor:colors.brandTertiary,alignItems:"center",justifyContent:"center"},
 title:{fontSize:25,fontWeight:"900",color:colors.onSurface,textAlign:"center"},
 body:{fontSize:14,color:colors.muted,lineHeight:21,textAlign:"center"},
 button:{minHeight:52,width:"100%",borderRadius:radius.pill,backgroundColor:colors.brandPrimary,alignItems:"center",justifyContent:"center"},
 buttonText:{color:"#fff",fontSize:15,fontWeight:"900"}
});

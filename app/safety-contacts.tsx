import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/lib/auth";
import { colors, radius, spacing } from "@/src/theme";

export default function SafetyContacts(){
 const insets=useSafeAreaInsets();const {session}=useAuth();
 const [name,setName]=useState("");const [phone,setPhone]=useState("");const [relationship,setRelationship]=useState("");
 const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);
 useEffect(()=>{let live=true;(async()=>{if(!session){setLoading(false);return;}const {data,error}=await supabase.from("user_emergency_contacts").select("*").eq("user_id",session.user.id).maybeSingle();if(error)Alert.alert("Could not load contact",error.message);else if(live&&data){setName(data.contact_name);setPhone(data.contact_phone);setRelationship(data.relationship??"");}if(live)setLoading(false);})();return()=>{live=false;};},[session?.user.id]);
 const save=async()=>{if(!session)return;if(name.trim().length<2||phone.trim().length<7){Alert.alert("Check details","Enter a contact name and valid phone number.");return;}setSaving(true);try{const {error}=await supabase.from("user_emergency_contacts").upsert({user_id:session.user.id,contact_name:name.trim(),contact_phone:phone.trim(),relationship:relationship.trim()||null,updated_at:new Date().toISOString()});if(error)throw error;Alert.alert("Saved","Your trusted emergency contact has been saved.");}catch(e:any){Alert.alert("Could not save",e?.message??"Please try again.");}finally{setSaving(false);}};
 if(loading)return <View style={s.center}><ActivityIndicator color={colors.brandPrimary}/></View>;
 return <ScrollView style={{flex:1,backgroundColor:colors.surface}} contentContainerStyle={{padding:spacing.xl,paddingTop:insets.top+spacing.lg,gap:spacing.md}}>
  <Text style={s.title}>Trusted emergency contact</Text>
  <Text style={s.note}>Save someone Lotty Go can identify as your trusted contact. This stores their details in your account; it does not automatically call or message them.</Text>
  <Text style={s.label}>CONTACT NAME</Text><TextInput value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={colors.muted} style={s.input}/>
  <Text style={s.label}>PHONE NUMBER</Text><TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+27..." placeholderTextColor={colors.muted} style={s.input}/>
  <Text style={s.label}>RELATIONSHIP (OPTIONAL)</Text><TextInput value={relationship} onChangeText={setRelationship} placeholder="Family, friend…" placeholderTextColor={colors.muted} style={s.input}/>
  <Pressable onPress={save} disabled={saving} style={s.button}><Text style={s.buttonText}>{saving?"Saving…":"Save emergency contact"}</Text></Pressable>
 </ScrollView>;
}
const s=StyleSheet.create({center:{flex:1,alignItems:"center",justifyContent:"center"},title:{fontSize:27,fontWeight:"900",color:colors.onSurface},note:{fontSize:13,color:colors.muted,lineHeight:20},label:{fontSize:11,fontWeight:"900",color:colors.onSurfaceSecondary,marginTop:spacing.md},input:{minHeight:50,borderWidth:1,borderColor: "#39301B",borderRadius: radius.lg,paddingHorizontal:spacing.md,color:colors.onSurface},button:{minHeight:52,borderRadius:radius.pill,backgroundColor:colors.brandPrimary,alignItems:"center",justifyContent:"center",marginTop:spacing.lg},buttonText:{color:"#fff",fontWeight:"900"}});
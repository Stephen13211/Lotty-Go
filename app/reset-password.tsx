import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/src/lib/supabase";
import { colors, radius, spacing } from "@/src/theme";

export default function ResetPassword() {
  const router = useRouter();
  const [password,setPassword] = useState("");
  const [confirm,setConfirm] = useState("");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [success,setSuccess] = useState(false);
  const submit = async () => {
    setError("");
    if(password.length<8){setError("Use at least 8 characters for your new password.");return;}
    if(password!==confirm){setError("The passwords do not match.");return;}
    setBusy(true);
    try {
      const {error:authError}=await supabase.auth.updateUser({password});
      if(authError)throw authError;
      setSuccess(true);
    } catch(e:any) {setError(e?.message??"Could not update password. Open the latest reset email link and try again.");}
    finally {setBusy(false);}
  };
  return <View style={s.root}>
    <Text style={s.title}>Choose a new password</Text>
    <Text style={s.sub}>Enter and confirm your new Lotty Go password.</Text>
    <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="New password" placeholderTextColor={colors.muted} style={s.input}/>
    <TextInput value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="Confirm new password" placeholderTextColor={colors.muted} style={s.input}/>
    {!!error&&<Text style={s.error}>{error}</Text>}
    {success?<><Text style={s.success}>Your password has been updated. You can now log in with it.</Text><Pressable onPress={()=>router.replace("/")} style={s.button}><Text style={s.buttonText}>Continue</Text></Pressable></>:<Pressable disabled={busy} onPress={submit} style={s.button}>{busy?<ActivityIndicator color={colors.onBrandPrimary}/>:<Text style={s.buttonText}>Update password</Text>}</Pressable>}
  </View>;
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:colors.surface,padding:spacing.xl,justifyContent:"center",gap:spacing.md},title:{fontSize:28,fontWeight:"900",color:colors.onSurface},sub:{fontSize:14,color:colors.muted,marginBottom:spacing.md},input:{backgroundColor:colors.surfaceSecondary,borderRadius:radius.md,padding:14,fontSize:16,color:colors.onSurface,borderWidth:1,borderColor:colors.border},button:{height:54,borderRadius:radius.pill,backgroundColor:colors.brandPrimary,alignItems:"center",justifyContent:"center",marginTop:spacing.md},buttonText:{fontSize:16,fontWeight:"800",color:colors.onBrandPrimary},error:{color:colors.error},success:{color:colors.success,fontWeight:"700"}});

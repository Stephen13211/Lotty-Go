import Icon from "@react-native-vector-icons/material-design-icons";
import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/src/lib/auth";
import { supabase } from "@/src/lib/supabase";
import { colors, radius, spacing } from "@/src/theme";

export default function RateTrip({rideId}:{rideId:string}) {
 const {session}=useAuth(); const qc=useQueryClient();
 const [score,setScore]=useState(5); const [comment,setComment]=useState(""); const [busy,setBusy]=useState(false);
 const {data:existing,isLoading}=useQuery({queryKey:["ride-rating",rideId,session?.user.id],enabled:!!session?.user.id,queryFn:async()=>{
  const {data,error}=await supabase.from("ride_ratings").select("score,comment").eq("ride_id",rideId).eq("reviewer_id",session!.user.id).maybeSingle();
  if(error)throw error; return data;
 }});
 if(isLoading)return null;
 if(existing)return <View style={{paddingTop:spacing.sm,gap:4}}><Text style={{fontSize:12,color:colors.muted,fontWeight:"700"}}>YOUR RATING</Text><Text style={{color:colors.brandPrimary,fontWeight:"900"}}>{"★".repeat(existing.score)}{"☆".repeat(5-existing.score)}</Text></View>;
 const submit=async()=>{if(!session)return;setBusy(true);try{const {error}=await supabase.rpc("submit_ride_rating",{p_ride_id:rideId,p_score:score,p_comment:comment.trim()||null});if(error)throw error;await qc.invalidateQueries({queryKey:["ride-rating",rideId]});Alert.alert("Thank you","Your trip rating has been submitted.");}catch(e:any){Alert.alert("Could not submit rating",e?.message??"Please try again.");}finally{setBusy(false);}};
 return <View style={{marginTop:spacing.md,padding:spacing.md,borderRadius:radius.md,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,gap:spacing.sm}}>
  <Text style={{fontWeight:"900",color:colors.onSurface}}>Rate this trip</Text>
  <View style={{flexDirection:"row",gap:spacing.md}}>{[1,2,3,4,5].map(n=><Pressable key={n} onPress={()=>setScore(n)}><Icon name={n<=score?"star":"star-outline"} size={27} color={colors.brandPrimary}/></Pressable>)}</View>
  <TextInput value={comment} onChangeText={setComment} maxLength={500} placeholder="Add a comment (optional)" placeholderTextColor={colors.muted} style={{minHeight:42,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.sm,color:colors.onSurface}}/>
  <Pressable disabled={busy} onPress={submit} style={{minHeight:42,borderRadius:radius.pill,backgroundColor:colors.brandPrimary,alignItems:"center",justifyContent:"center"}}><Text style={{color:"#fff",fontWeight:"900"}}>{busy?"Submitting…":"Submit rating"}</Text></Pressable>
 </View>;
}
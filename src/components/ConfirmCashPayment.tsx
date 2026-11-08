import { useState } from "react";
import { Alert, Pressable, Text } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/src/lib/supabase";
import { colors, radius, spacing } from "@/src/theme";
export default function ConfirmCashPayment({rideId}:{rideId:string}){
 const [busy,setBusy]=useState(false);const qc=useQueryClient();
 const confirm=()=>Alert.alert("Confirm cash received?","Only confirm if the rider has actually paid you the full cash fare. The app will record the 75% driver share and 25% Lotty Go commission due.",[{text:"Not yet",style:"cancel"},{text:"Confirm cash received",onPress:async()=>{setBusy(true);try{const {data,error}=await supabase.rpc("confirm_cash_payment",{p_ride_id:rideId});if(error)throw error;const result=Array.isArray(data)?data[0]:data;Alert.alert("Cash recorded",`Driver share: R${Number(result?.driver_share??0).toFixed(2)}\nLotty Go commission due: R${Number(result?.lotty_share??0).toFixed(2)}`);await qc.invalidateQueries({queryKey:["driver-trips"]});await qc.invalidateQueries({queryKey:["my-rides"]});await qc.invalidateQueries({queryKey:["driver-rides"]});}catch(e:any){Alert.alert("Could not record cash",e?.message??"Please try again.");}finally{setBusy(false);}}}]);
 return <Pressable disabled={busy} onPress={confirm} style={{marginTop:spacing.sm,minHeight:42,borderRadius:radius.pill,backgroundColor:colors.brandPrimary,alignItems:"center",justifyContent:"center"}}><Text style={{color:"#fff",fontWeight:"900"}}>{busy?"Saving…":"Confirm cash received"}</Text></Pressable>;
}
import Icon from "@react-native-vector-icons/material-design-icons";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import type { Ride } from "@/src/lib/rides";
import { cancelRide } from "@/src/lib/activeRide";
import { colors, radius, spacing } from "@/src/theme";
import { MapView, Marker } from "@/src/components/map";
import type { NearbyDriver } from "@/src/lib/rides";

const reasons=["Changed my mind","Booked by mistake","Pickup location is wrong","Destination or trip details changed","Found another ride","Safety concern","Other"];
export default function RideMatchingScreen({ride,dispatchStatus,nearbyDrivers=[]}:{ride:Ride;dispatchStatus?:string;nearbyDrivers?:NearbyDriver[]}) {
 const qc=useQueryClient();const [showReasons,setShowReasons]=useState(false);const [busy,setBusy]=useState(false);
 const choose= (reason:string)=>Alert.alert("Cancel ride request?", "Your request has not been accepted by a driver yet. No close-pickup cancellation fee applies.",[
  {text:"Keep searching",style:"cancel"},
  {text:"Cancel request",style:"destructive",onPress:async()=>{setBusy(true);try{await cancelRide(ride.id,reason);qc.invalidateQueries({queryKey:["requested-ride"]});qc.invalidateQueries({queryKey:["my-rides"]});}catch(e:any){Alert.alert("Could not cancel",e?.message??"Please try again.");}finally{setBusy(false);}}}
 ]);
 return <ScrollView style={s.scroll} contentContainerStyle={s.root} keyboardShouldPersistTaps="handled">
  <View style={s.mapWrap}>
   <MapView style={StyleSheet.absoluteFill} region={{latitude:ride.pickup_lat,longitude:ride.pickup_lng,latitudeDelta:0.045,longitudeDelta:0.045}}>
    <Marker coordinate={{latitude:ride.pickup_lat,longitude:ride.pickup_lng}} pinColor={colors.brandPrimary}/>
    {nearbyDrivers.map((driver,index)=><Marker key={`search-car-${index}`} coordinate={{latitude:driver.latitude,longitude:driver.longitude}}>
     <View style={s.carMarker}><Icon name={driver.vehicle_type==="motorcycle"?"motorbike":"car-side"} size={18} color="#FFFFFF"/></View>
    </Marker>)}
   </MapView>
  </View>
  <View style={s.icon}><Icon name="car-search" size={42} color={colors.brandPrimary}/></View>
  <Text style={s.title}>Finding your driver</Text>
  <Text style={s.subtitle}>Your ride request has been sent to eligible nearby drivers. We'll update this screen when a driver accepts.</Text>
  <View style={s.card}>
   <Text style={s.label}>PICKUP</Text><Text style={s.address}>{ride.pickup_address}</Text>
   {ride.stops?.map((stop,i)=><View key={i}><Text style={s.label}>STOP {i+1}</Text><Text style={s.address}>{stop.address}</Text></View>)}
   <Text style={s.label}>DESTINATION</Text><Text style={s.address}>{ride.dropoff_address}</Text>
   <View style={s.row}><Text style={s.muted}>{ride.distance_km.toFixed(1)} km · {ride.ride_type.replace(/_/g," ")}</Text><Text style={s.fare}>R{Number(ride.fare).toFixed(2)}</Text></View>
  </View>
  <View style={s.searching}>{dispatchStatus==="searching"?<Icon name="car-off" size={20} color={colors.brandPrimary}/>:<ActivityIndicator color={colors.brandPrimary}/>}<Text style={s.muted}>{dispatchStatus==="searching"?"No eligible driver is available right now. We'll keep checking nearby drivers.":"Offering your ride to nearby drivers. Each driver has 10 seconds to accept."}</Text></View>
  <Pressable disabled={busy} onPress={()=>setShowReasons(v=>!v)} style={s.cancel}>{busy?<ActivityIndicator color={colors.error}/>:<Text style={s.cancelText}>Cancel request</Text>}</Pressable>
  {showReasons?<View style={s.reasons}><Text style={s.label}>WHY ARE YOU CANCELLING?</Text>{reasons.map(r=><Pressable key={r} onPress={()=>choose(r)} style={s.reason}><Text style={s.address}>{r}</Text></Pressable>)}</View>:null}
 </ScrollView>;
}
const s=StyleSheet.create({scroll:{flex:1,backgroundColor:colors.surface},root:{flexGrow:1,backgroundColor:colors.surface,padding:spacing.lg,paddingTop:spacing.lg,paddingBottom:spacing.xxl,justifyContent:"center",gap:spacing.md},mapWrap:{height:190,borderRadius:radius.lg,overflow:"hidden",borderWidth:1,borderColor:colors.border},carMarker:{width:30,height:30,borderRadius:15,backgroundColor:colors.brandPrimary,borderWidth:2,borderColor:"#FFFFFF",alignItems:"center",justifyContent:"center"},icon:{width:84,height:84,borderRadius:42,backgroundColor:colors.brandTertiary,alignItems:"center",justifyContent:"center",alignSelf:"center"},title:{fontSize:25,fontWeight:"900",color:colors.onSurface,textAlign:"center"},subtitle:{fontSize:14,color:colors.muted,lineHeight:21,textAlign:"center"},card:{padding:spacing.lg,backgroundColor:colors.surfaceSecondary,borderRadius:radius.lg,gap:spacing.sm},label:{fontSize:10,fontWeight:"900",letterSpacing:1,color:colors.muted},address:{fontSize:14,fontWeight:"700",color:colors.onSurface},row:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginTop:spacing.sm},muted:{fontSize:12,color:colors.muted},fare:{fontSize:19,fontWeight:"900",color:colors.brandPrimary},searching:{flexDirection:"row",gap:spacing.sm,alignItems:"center",justifyContent:"center",padding:spacing.md},cancel:{alignItems:"center",padding:spacing.md},cancelText:{color:colors.error,fontWeight:"800"},reasons:{backgroundColor:colors.surfaceSecondary,borderRadius:radius.md,padding:spacing.md,gap:spacing.xs},reason:{paddingVertical:spacing.sm,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border}});

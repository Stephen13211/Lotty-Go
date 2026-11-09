import Icon from "@react-native-vector-icons/material-design-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MapView, Marker } from "@/src/components/map";
import { useAuth } from "@/src/lib/auth";
import { getDriverProfile, setDriverAvailability } from "@/src/lib/driver";
import { acceptRide, declineRideOffer, getMyRideOffer } from "@/src/lib/rides";
import { getActiveRide } from "@/src/lib/activeRide";
import ActiveRideScreen from "@/src/components/ActiveRideScreen";
import { colors, radius, spacing } from "@/src/theme";

export default function DriverHome() {
 const insets=useSafeAreaInsets();const router=useRouter();const {session,configured}=useAuth();const qc=useQueryClient();
 const [online,setOnline]=useState(false);const [coords,setCoords]=useState({latitude:-26.2041,longitude:28.0473});const [now,setNow]=useState(Date.now());
 const hadActiveRide=useRef(false);
 const {data:profile,isLoading:profileLoading}=useQuery({queryKey:["driver-profile",session?.user.id],queryFn:()=>getDriverProfile(session!.user.id),enabled:configured&&!!session});
 const approved=profile?.application_status==="approved";
 const {data:activeRide}=useQuery({queryKey:["active-ride",session?.user.id,"driver"],queryFn:()=>getActiveRide(session!.user.id,"driver"),enabled:configured&&!!session,refetchInterval:2000});
 const {data:offer}=useQuery({queryKey:["driver-ride-offer",session?.user.id],queryFn:()=>getMyRideOffer(),enabled:configured&&!!session&&online&&approved&&!activeRide,refetchInterval:online&&approved&&!activeRide?1000:false});
 const next=offer?.ride;
 const secondsLeft=offer?Math.max(0,Math.ceil((new Date(offer.expires_at).getTime()-now)/1000)):0;

 useEffect(()=>{if(activeRide){hadActiveRide.current=true;}else if(hadActiveRide.current){hadActiveRide.current=false;setOnline(false);qc.invalidateQueries({queryKey:["driver-ride-offer"]});}},[activeRide?.id,qc]);
 useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),250);return()=>clearInterval(id);},[]);

 useEffect(()=>{
  if(!online||!session)return;
  let alive=true;let subscription:Location.LocationSubscription|undefined;
  const publish=async()=>{
   try{
    const loc=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});
    if(!alive)return;
    const point={latitude:loc.coords.latitude,longitude:loc.coords.longitude};
    setCoords(point);
    await setDriverAvailability(true,point.latitude,point.longitude);
   }catch(e){if(alive)console.warn("Lotty Go location heartbeat failed",e);}
  };
  publish();
  const heartbeat=setInterval(publish,10000);
  (async()=>{
   try{
    subscription=await Location.watchPositionAsync({accuracy:Location.Accuracy.Balanced,timeInterval:5000,distanceInterval:5},loc=>{
     const point={latitude:loc.coords.latitude,longitude:loc.coords.longitude};
     setCoords(point);
     setDriverAvailability(true,point.latitude,point.longitude).catch(e=>console.warn("Location update failed",e));
    });
   }catch(e){if(alive)Alert.alert("Location unavailable","Lotty Go needs location access to keep you visible to nearby riders.");}
  })();
  return()=>{alive=false;clearInterval(heartbeat);subscription?.remove();};
 },[online,session?.user.id]);

 const accept=async()=>{
  if(!session||!next)return;
  try{await acceptRide(next.id);setOnline(false);qc.invalidateQueries({queryKey:["driver-ride-offer"]});qc.invalidateQueries({queryKey:["active-ride"]});Alert.alert("Ride accepted","Head to the pickup location.");}
  catch(e:any){qc.invalidateQueries({queryKey:["driver-ride-offer"]});Alert.alert("Offer unavailable",e?.message??"This offer may have expired. Waiting for the next request.");}
 };
 const decline=async()=>{
  if(!next)return;
  try{await declineRideOffer(next.id);qc.invalidateQueries({queryKey:["driver-ride-offer"]});}
  catch(e:any){Alert.alert("Could not decline",e?.message??"Please try again.");}
 };
 const toggleOnline=async()=>{
  if(!approved){Alert.alert("Approval required","Your driver application must be approved before you can go online.");router.push("/driver-application");return;}
  try{
   const permission=await Location.requestForegroundPermissionsAsync();
   if(permission.status!=="granted"){Alert.alert("Location required","Allow location access so nearby riders can find you.");return;}
   const current=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});
   const point={latitude:current.coords.latitude,longitude:current.coords.longitude};
   await setDriverAvailability(true,point.latitude,point.longitude);
   setCoords(point);setOnline(true);
  }catch(e:any){Alert.alert("Could not go online",e?.message??"Please check your location and try again.");}
 };
 const goOffline=async()=>{
  try{await setDriverAvailability(false);setOnline(false);qc.invalidateQueries({queryKey:["driver-ride-offer"]});}
  catch(e:any){Alert.alert("Could not go offline",e?.message??"Please try again.");}
 };
 if(activeRide)return <ActiveRideScreen ride={activeRide} role="driver"/>;
 return <View style={{flex:1}}>
  <MapView style={StyleSheet.absoluteFill} region={{...coords,latitudeDelta:0.05,longitudeDelta:0.05}} showsUserLocation><Marker coordinate={coords}/></MapView>
  <View style={[s.pill,{top:insets.top+spacing.md}]}><Icon name="cash" size={16} color="#fff"/><Text style={{color:"#fff",fontWeight:"700",fontSize:13}}>Today: R0</Text></View>
  <View style={[s.status,{top:insets.top+spacing.md,backgroundColor:online?colors.success:colors.surfaceInverse}]}><View style={[s.dot,{backgroundColor:online?"#4ADE80":colors.muted}]}/><Text style={{color:"#fff",fontWeight:"800",fontSize:11,letterSpacing:1}}>{online?"ONLINE":"OFFLINE"}</Text></View>
  <ScrollView style={s.sheet} contentContainerStyle={{padding:spacing.xl,paddingBottom:insets.bottom+spacing.lg,gap:spacing.md}}>
   {profileLoading?<ActivityIndicator color={colors.brandPrimary}/>:!approved?<><Text style={s.title}>Start driving with Lotty Go</Text><Text style={{color:colors.muted}}>Complete your driver application and submit the required documents. Lotty Go must approve your profile before you can receive requests.</Text><View style={s.notice}><Icon name="shield-lock-outline" size={24} color={colors.brandPrimary}/><Text style={{flex:1,color:colors.onBrandTertiary,fontSize:13}}>Online mode is locked until your driver application is approved.</Text></View><Pressable onPress={()=>router.push("/driver-application")} style={s.accept}><Text style={{color:colors.onBrandSecondary,fontWeight:"800",fontSize:16}}>Complete driver application</Text></Pressable></>:!online?<><Text style={s.title}>You're approved and ready</Text><Text style={{color:colors.muted}}>Go online when you're ready to receive eligible ride or courier requests.</Text><Pressable onPress={toggleOnline} style={s.go}><Text style={s.goT}>GO</Text></Pressable></>:next?<View style={{gap:spacing.md}}><Text style={{color:colors.brandPrimary,fontWeight:"800",fontSize:13}}>NEW REQUEST · {secondsLeft}s LEFT</Text><Text style={{fontSize:20,fontWeight:"800",color:colors.onSurface}} numberOfLines={1}>{next.dropoff_address}</Text><Text style={{fontSize:12,color:colors.muted}}>Pickup: {next.pickup_address}</Text><View style={{flexDirection:"row",gap:spacing.sm}}><Stat label="Fare" v={`R${Number(next.fare).toFixed(2)}`}/><Stat label="Distance" v={`${next.distance_km} km`}/><Stat label="Type" v={next.ride_type.replace(/_/g," ")}/></View><Pressable disabled={secondsLeft===0} onPress={accept} style={[s.accept,secondsLeft===0&&{opacity:0.5}]}><Text style={{color:colors.onBrandSecondary,fontWeight:"800",fontSize:17}}>Accept request</Text></Pressable><Pressable onPress={decline} style={s.offline}><Text style={{color:colors.onSurface,fontWeight:"700"}}>Decline request</Text></Pressable><Pressable onPress={goOffline} style={s.offline}><Text style={{color:colors.onSurface,fontWeight:"700"}}>Go offline</Text></Pressable></View>:<><Text style={s.title}>You're online</Text><Text style={{color:colors.muted}}>Waiting for a nearby request. Your location is refreshed automatically every 10 seconds.</Text><Pressable onPress={goOffline} style={s.offline}><Text style={{color:colors.onSurface,fontWeight:"700"}}>Go offline</Text></Pressable></>}
  </ScrollView>
 </View>;
}
function Stat({label,v}:{label:string;v:string}){return <View style={s.stat}><Text style={{fontSize:11,color:colors.muted,fontWeight:"700"}}>{label}</Text><Text style={{fontSize:15,fontWeight:"800",color:colors.onSurface,textTransform:"capitalize"}}>{v}</Text></View>;}
const s=StyleSheet.create({pill:{position:"absolute",alignSelf:"center",flexDirection:"row",alignItems:"center",gap:4,paddingHorizontal:spacing.lg,paddingVertical:8,backgroundColor:colors.surfaceInverse,borderRadius:radius.pill},status:{position:"absolute",left:spacing.lg,flexDirection:"row",alignItems:"center",gap:4,paddingHorizontal:spacing.md,paddingVertical:6,borderRadius:radius.pill},dot:{width:8,height:8,borderRadius:4},sheet:{position:"absolute",left:0,right:0,bottom:0,maxHeight:"55%",backgroundColor:colors.surface,borderTopLeftRadius:radius.lg,borderTopRightRadius:radius.lg,elevation:10},title:{fontSize:22,fontWeight:"800",color:colors.onSurface},go:{alignSelf:"center",width:160,height:160,borderRadius:999,backgroundColor:colors.brandPrimary,alignItems:"center",justifyContent:"center",marginTop:spacing.md},goT:{color:colors.onBrandPrimary,fontSize:48,fontWeight:"900",letterSpacing:2},offline:{alignSelf:"center",paddingHorizontal:spacing.xl,paddingVertical:spacing.md,borderRadius:radius.pill,backgroundColor:colors.surfaceSecondary,borderWidth:1,borderColor:colors.border,marginTop:spacing.md},stat:{flex:1,padding:spacing.md,borderRadius:radius.md,backgroundColor:colors.surfaceSecondary},accept:{minHeight:56,borderRadius:radius.pill,backgroundColor:colors.brandSecondary,alignItems:"center",justifyContent:"center"},notice:{flexDirection:"row",alignItems:"center",gap:spacing.md,padding:spacing.lg,borderRadius:radius.md,backgroundColor:colors.brandTertiary}});

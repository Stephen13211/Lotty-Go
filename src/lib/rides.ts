import { supabase } from "./supabase";

export type RideType = "lotty_x" | "lotty_comfort" | "lotty_xl" | "courier_motorcycle";
export type RideStatus = "requested" | "accepted" | "in_progress" | "completed" | "cancelled";
export type PaymentMethod = "cash" | "card";
export type Ride = {
 id:string;rider_id:string;driver_id:string|null;
 pickup_address:string;pickup_lat:number;pickup_lng:number;
 dropoff_address:string;dropoff_lat:number;dropoff_lng:number;
 stops?:{address:string;latitude:number;longitude:number}[];
 ride_type:RideType;payment_method:PaymentMethod;fare:number;distance_km:number;
 status:RideStatus;created_at:string;payment_status?:string;cash_collected_at?:string|null;service_notes?:string|null;
 driver_arrived_at?:string|null;trip_started_at?:string|null;trip_completed_at?:string|null;
 waiting_fee_amount?:number;waiting_fee_minutes?:number;driver_latitude?:number|null;driver_longitude?:number|null;
 driver_location_updated_at?:string|null;dispatch_attempt_count?:number;
};
export type RideOffer={ride:Ride;expires_at:string};
export type NearbyDriver={latitude:number;longitude:number;vehicle_type:string};

export const RIDE_OPTIONS:{type:RideType;name:string;seats:number;multiplier:number;icon:string;available?:boolean}[]=[
 {type:"lotty_x",name:"Lotty Go",seats:2,multiplier:0.8,icon:"car"},
 {type:"lotty_comfort",name:"Lotty Standard",seats:4,multiplier:1,icon:"car-sports"},
 {type:"lotty_xl",name:"Lotty Women",seats:4,multiplier:1,icon:"account-heart",available:true},
 {type:"courier_motorcycle",name:"Lotty Courier",seats:1,multiplier:0.75,icon:"motorbike",available:true}
];
export function estimateFare(km:number,m:number){return Math.round((20+km*9)*m);}
export function haversineKm(a:{latitude:number;longitude:number},b:{latitude:number;longitude:number}){
 const R=6371,dLat=(b.latitude-a.latitude)*Math.PI/180,dLon=(b.longitude-a.longitude)*Math.PI/180;
 const la1=a.latitude*Math.PI/180,la2=b.latitude*Math.PI/180;
 const h=Math.sin(dLat/2)**2+Math.sin(dLon/2)**2*Math.cos(la1)*Math.cos(la2);
 return 2*R*Math.asin(Math.sqrt(h));
}
export async function createRide(input:Omit<Ride,"id"|"created_at"|"status"|"driver_id">){
 const {data,error}=await supabase.from("rides").insert({...input,status:"requested"}).select().single();
 if(error)throw error;return data as Ride;
}
export async function advanceRideDispatch(rideId:string){
 const {data,error}=await supabase.rpc("advance_ride_dispatch",{p_ride_id:rideId});
 if(error)throw error;return (data?.[0]??null) as {dispatch_status:string;offered_driver_id:string|null;offer_expires_at:string|null;attempts:number}|null;
}
export async function getMyRideOffer():Promise<RideOffer|null>{
 const {data,error}=await supabase.rpc("get_my_ride_offer");
 if(error)throw error;
 const offer=data?.[0] as {ride_id:string;expires_at:string}|undefined;
 if(!offer)return null;
 const {data:ride,error:rideError}=await supabase.from("rides").select("*").eq("id",offer.ride_id).eq("status","requested").maybeSingle();
 if(rideError)throw rideError;
 if(!ride)return null;
 return {ride:ride as Ride,expires_at:offer.expires_at};
}
export async function getNearbyOnlineDrivers(point:{latitude:number;longitude:number},rideType:RideType){
 const {data,error}=await supabase.rpc("get_nearby_online_drivers",{p_latitude:point.latitude,p_longitude:point.longitude,p_ride_type:rideType});
 if(error)throw error;return (data??[]) as NearbyDriver[];
}
export async function acceptRide(rideId:string){
 const {data,error}=await supabase.rpc("accept_ride_offer",{p_ride_id:rideId}).single();
 if(error)throw error;return data as Ride;
}
export async function declineRideOffer(rideId:string){
 const {error}=await supabase.rpc("decline_ride_offer",{p_ride_id:rideId});if(error)throw error;
}
export async function listMyRides(){
 const {data,error}=await supabase.from("rides").select("*").order("created_at",{ascending:false});
 if(error)throw error;return (data??[]) as Ride[];
}
export async function listOpenRides(driverId:string){
 const {data:profile,error:profileError}=await supabase.from("driver_profiles").select("application_status,vehicle_type,women_riders_only,women_service_approved,payout_provider,payout_recipient_id,payout_status").eq("user_id",driverId).maybeSingle();
 if(profileError)throw profileError;
 if(!profile||profile.application_status!=="approved")return[];
 const {data:availability,error:availabilityError}=await supabase.from("driver_availability").select("latitude,longitude,location_updated_at,is_online").eq("driver_id",driverId).maybeSingle();
 if(availabilityError)throw availabilityError;
 if(!availability?.is_online||availability.latitude==null||availability.longitude==null||!availability.location_updated_at||Date.now()-new Date(availability.location_updated_at).getTime()>90000)return[];
 const {data,error}=await supabase.from("rides").select("*").eq("status","requested").order("created_at",{ascending:true});
 if(error)throw error;
 return (data??[]).filter((ride:Ride)=>{
  if(profile.vehicle_type==="motorcycle"&&ride.ride_type!=="courier_motorcycle")return false;
  if(profile.vehicle_type==="car"&&ride.ride_type==="courier_motorcycle")return false;
  if(ride.ride_type==="lotty_xl"&&!profile.women_service_approved)return false;
  if(profile.women_riders_only&&ride.ride_type!=="lotty_xl")return false;
  if(ride.payment_method==="card"&&(profile.payout_provider!=="paystack"||!profile.payout_recipient_id||profile.payout_status!=="verified"))return false;
  return haversineKm({latitude:availability.latitude!,longitude:availability.longitude!},{latitude:ride.pickup_lat,longitude:ride.pickup_lng})<=20;
 }).sort((a:Ride,b:Ride)=>haversineKm({latitude:availability.latitude!,longitude:availability.longitude!},{latitude:a.pickup_lat,longitude:a.pickup_lng})-haversineKm({latitude:availability.latitude!,longitude:availability.longitude!},{latitude:b.pickup_lat,longitude:b.pickup_lng})) as Ride[];
}
export async function updateRideStatus(rideId:string,status:RideStatus){
 const {error}=await supabase.from("rides").update({status}).eq("id",rideId);if(error)throw error;
}

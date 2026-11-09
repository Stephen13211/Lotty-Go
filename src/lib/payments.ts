import { supabase } from "./supabase";

export type CardPaymentStart = { authorization_url: string; reference: string; amount: number; currency: "ZAR" } | { already_paid: true; message: string };

export async function initiateCardPayment(rideId: string): Promise<CardPaymentStart> {
  const { data, error } = await supabase.functions.invoke("paystack-initiate-payment", { body: { ride_id: rideId } });
  if (error) {
    let message = error.message;
    try {
      const details = await (error as any).context?.json?.();
      if (details?.error) message = details.error;
    } catch {}
    throw new Error(message || "Could not start card payment.");
  }
  if (data?.already_paid) return data as CardPaymentStart;
  if (typeof data?.authorization_url !== "string") throw new Error(data?.error ?? "Paystack did not return a payment link.");
  return data as CardPaymentStart;
}

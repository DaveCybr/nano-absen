import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { image_base64 } = await req.json();

    const apiKey = Deno.env.get("FACEPP_API_KEY") ?? "";
    const apiSecret = Deno.env.get("FACEPP_API_SECRET") ?? "";

    if (!apiKey || !apiSecret) {
      return new Response(
        JSON.stringify({ error: "Face++ credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const form = new FormData();
    form.append("api_key", apiKey);
    form.append("api_secret", apiSecret);
    form.append("image_base64", image_base64);

    const res = await fetch("https://api-us.faceplusplus.com/facepp/v3/detect", {
      method: "POST",
      body: form,
    });

    const data = await res.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

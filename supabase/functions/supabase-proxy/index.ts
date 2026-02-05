import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Supabase-Auth",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const path = url.searchParams.get("path");
    const method = url.searchParams.get("method") || req.method;

    if (!path) {
      return new Response(
        JSON.stringify({ error: "Missing 'path' query parameter" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get auth token from header
    const authHeader = req.headers.get("X-Supabase-Auth") || req.headers.get("Authorization");
    
    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: authHeader ? { Authorization: authHeader } : {},
      },
    });

    // Parse request body if present
    let body = null;
    if (req.body && (method === "POST" || method === "PUT" || method === "PATCH")) {
      const text = await req.text();
      if (text) {
        body = JSON.parse(text);
      }
    }

    // Route to appropriate Supabase method
    let response;

    // Auth endpoints
    if (path === "/auth/signup") {
      response = await supabase.auth.signUp(body);
    } else if (path === "/auth/signin") {
      response = await supabase.auth.signInWithPassword(body);
    } else if (path === "/auth/signout") {
      response = await supabase.auth.signOut();
    } else if (path === "/auth/session") {
      response = await supabase.auth.getSession();
    } else if (path === "/auth/user") {
      response = await supabase.auth.getUser(authHeader?.replace('Bearer ', ''));
    } 
    // Database endpoints - use rpc for complex queries
    else if (path.startsWith("/rpc/")) {
      const functionName = path.replace("/rpc/", "");
      response = await supabase.rpc(functionName, body);
    }
    // Generic REST endpoint proxy
    else if (path.startsWith("/rest/")) {
      const restPath = path.replace("/rest/", "");
      const targetUrl = `${supabaseUrl}/rest/v1/${restPath}${url.search.replace(`path=${encodeURIComponent(path)}&`, '').replace(`path=${encodeURIComponent(path)}`, '').replace(`method=${method}&`, '').replace(`method=${method}`, '')}`;
      
      const headers: Record<string, string> = {
        "apikey": supabaseKey,
        "Content-Type": "application/json",
      };
      
      if (authHeader) {
        headers["Authorization"] = authHeader;
      }

      const restResponse = await fetch(targetUrl, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await restResponse.json();
      return new Response(JSON.stringify({ data, error: restResponse.ok ? null : data }), {
        status: restResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      return new Response(
        JSON.stringify({ error: "Unsupported path. Use /auth/*, /rpc/*, or /rest/*" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
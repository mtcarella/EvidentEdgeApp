import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function capitalizeWords(text: string | undefined | null): string {
  if (!text) return '';

  const cleaned = text.replace(/,/g, '').trim();
  const allCapsWords = ['LLC', 'LLP', 'PC', 'PA', 'INC', 'CORP', 'LP'];

  return cleaned
    .toLowerCase()
    .split(' ')
    .map(word => {
      const upperWord = word.toUpperCase();
      if (allCapsWords.includes(upperWord)) {
        return upperWord;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all contacts with company names
    const { data: contacts, error: fetchError } = await supabase
      .from("contacts")
      .select("id, company")
      .not("company", "is", null);

    if (fetchError) {
      throw fetchError;
    }

    let updatedCount = 0;
    let skippedCount = 0;
    const errors: any[] = [];

    // Process each contact
    for (const contact of contacts || []) {
      if (!contact.company) {
        skippedCount++;
        continue;
      }

      const formattedCompany = capitalizeWords(contact.company);

      // Only update if the formatting changed
      if (formattedCompany !== contact.company) {
        const { error: updateError } = await supabase
          .from("contacts")
          .update({ company: formattedCompany })
          .eq("id", contact.id);

        if (updateError) {
          errors.push({
            id: contact.id,
            originalCompany: contact.company,
            error: updateError.message,
          });
        } else {
          updatedCount++;
        }
      } else {
        skippedCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalContacts: contacts?.length || 0,
        updatedCount,
        skippedCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
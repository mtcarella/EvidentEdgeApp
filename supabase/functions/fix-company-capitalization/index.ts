import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { corsHeaders, jsonResponse, requireCaller } from '../_shared/auth.ts';

function capitalizeWords(text: string | undefined | null): string {
  if (!text) return '';
  const cleaned = text.replace(/,/g, '').trim();
  const allCapsWords = ['LLC', 'LLP', 'PC', 'PA', 'INC', 'CORP', 'LP'];

  return cleaned
    .toLowerCase()
    .split(' ')
    .map((word) => {
      const upperWord = word.toUpperCase();
      if (allCapsWords.includes(upperWord)) return upperWord;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const auth = await requireCaller(req, { requireRoles: ['admin', 'super_admin'] });
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  try {
    const { data: contacts, error: fetchError } = await supabase
      .from('contacts')
      .select('id, company')
      .not('company', 'is', null);

    if (fetchError) {
      return jsonResponse({ error: fetchError.message }, 500);
    }

    let updatedCount = 0;
    let skippedCount = 0;
    const errors: any[] = [];

    for (const contact of contacts || []) {
      if (!contact.company) {
        skippedCount++;
        continue;
      }

      const formattedCompany = capitalizeWords(contact.company);

      if (formattedCompany !== contact.company) {
        const { error: updateError } = await supabase
          .from('contacts')
          .update({ company: formattedCompany })
          .eq('id', contact.id);

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

    return jsonResponse({
      success: true,
      totalContacts: contacts?.length || 0,
      updatedCount,
      skippedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('fix-company-capitalization error:', error?.message ?? error);
    return jsonResponse({ success: false, error: 'Internal error' }, 500);
  }
});

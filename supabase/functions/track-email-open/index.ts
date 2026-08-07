import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const TRANSPARENT_1X1_GIF = Uint8Array.from(
  atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'),
  (c) => c.charCodeAt(0),
);

Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const trackingId = url.searchParams.get('id');

    if (!trackingId) {
      return new Response(TRANSPARENT_1X1_GIF, {
        headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: existing } = await supabase
      .from('resource_email_sends')
      .select('id, opened_at, open_count')
      .eq('id', trackingId)
      .maybeSingle();

    if (existing) {
      const updates: Record<string, unknown> = {
        open_count: (existing.open_count || 0) + 1,
      };
      if (!existing.opened_at) {
        updates.opened_at = new Date().toISOString();
      }
      await supabase
        .from('resource_email_sends')
        .update(updates)
        .eq('id', trackingId);
    }

    return new Response(TRANSPARENT_1X1_GIF, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch {
    return new Response(TRANSPARENT_1X1_GIF, {
      headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' },
    });
  }
});

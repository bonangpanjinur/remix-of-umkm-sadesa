const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-requested-with',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const BASE_URL = 'https://wilayah.id/api';
const EMSIFA_URL = 'https://www.emsifa.com/api-wilayah-indonesia/api';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const type = url.searchParams.get('type');
    const code = url.searchParams.get('code');

    if (!type) {
      return new Response(
        JSON.stringify({ error: 'Missing type parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build URLs for both APIs
    let wilayahUrl: string;
    let emsifaUrl: string;

    switch (type) {
      case 'provinces':
        wilayahUrl = `${BASE_URL}/provinces.json`;
        emsifaUrl = `${EMSIFA_URL}/provinces.json`;
        break;
      case 'regencies':
        if (!code) {
          return new Response(JSON.stringify({ error: 'Missing code parameter' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        wilayahUrl = `${BASE_URL}/regencies/${code}.json`;
        emsifaUrl = `${EMSIFA_URL}/regencies/${code}.json`;
        break;
      case 'districts':
        if (!code) {
          return new Response(JSON.stringify({ error: 'Missing code parameter' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        wilayahUrl = `${BASE_URL}/districts/${code}.json`;
        emsifaUrl = `${EMSIFA_URL}/districts/${code}.json`;
        break;
      case 'villages':
        if (!code) {
          return new Response(JSON.stringify({ error: 'Missing code parameter' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        wilayahUrl = `${BASE_URL}/villages/${code}.json`;
        emsifaUrl = `${EMSIFA_URL}/villages/${code}.json`;
        break;
      default:
        return new Response(JSON.stringify({ error: 'Invalid type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Try emsifa first as it's more reliable for public access, fallback to wilayah.id
    let data;
    try {
      console.log(`Fetching: ${emsifaUrl}`);
      const response = await fetch(emsifaUrl, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'DesaApp/1.0' },
      });
      if (!response.ok) throw new Error(`emsifa returned ${response.status}`);
      const json = await response.json();
      // emsifa uses {id, name} format, normalize to {code, name}
      data = Array.isArray(json)
        ? json.map((item: { id: string; name: string }) => ({ code: item.id, name: item.name }))
        : json;
    } catch (e) {
      console.warn('emsifa failed, trying wilayah.id:', e);
      const response = await fetch(wilayahUrl, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'DesaApp/1.0' },
      });
      if (!response.ok) throw new Error(`wilayah.id returned ${response.status}`);
      const json = await response.json();
      data = json.data || json;
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

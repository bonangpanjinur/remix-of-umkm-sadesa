const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-requested-with',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const EMSIFA_URL = 'https://www.emsifa.com/api-wilayah-indonesia/api';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
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

    let emsifaUrl: string;
    switch (type) {
      case 'provinces':
        emsifaUrl = `${EMSIFA_URL}/provinces.json`;
        break;
      case 'regencies':
        if (!code) {
          return new Response(JSON.stringify({ error: 'Missing code parameter' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        emsifaUrl = `${EMSIFA_URL}/regencies/${code}.json`;
        break;
      case 'districts':
        if (!code) {
          return new Response(JSON.stringify({ error: 'Missing code parameter' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        emsifaUrl = `${EMSIFA_URL}/districts/${code}.json`;
        break;
      case 'villages':
        if (!code) {
          return new Response(JSON.stringify({ error: 'Missing code parameter' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        emsifaUrl = `${EMSIFA_URL}/villages/${code}.json`;
        break;
      default:
        return new Response(JSON.stringify({ error: 'Invalid type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`Fetching: ${emsifaUrl}`);
    const response = await fetch(emsifaUrl, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'DesaApp/1.0' },
    });

    if (!response.ok) {
      throw new Error(`emsifa returned ${response.status}`);
    }

    const json = await response.json();
    // Normalize emsifa {id, name} to {code, name}
    const data = Array.isArray(json)
      ? json.map((item: { id: string; name: string }) => ({ code: item.id, name: item.name }))
      : json;

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

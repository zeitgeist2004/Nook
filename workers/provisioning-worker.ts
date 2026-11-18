/**
 * ============================================================================
 * NOOK MOBILE — CLOUDFLARE WORKER DE PROVISIONAMENTO DE TÚNEIS
 * Gerenciamento automatizado de túneis exclusivos por instalação do Nook
 * ============================================================================
 * 
 * Este serviço roda na infraestrutura Cloudflare (Edge Workers) administrada
 * pelo projeto Nook. Ele isola as credenciais administrativas (API Token),
 * garantindo que o executável distribuído aos usuários NUNCA contenha chaves
 * mestras da Cloudflare.
 * 
 * Funcionalidades:
 * 1. Provisionamento de Túnel exclusivo por instalação do Nook.
 * 2. Criação automática de entrada DNS CNAME (ex: <uuid>.remote.nookapp.io).
 * 3. Rate limiting e mitigação contra abuso via Cloudflare KV.
 * 4. Revogação e exclusão limpa de túneis e hostnames.
 */

export interface Env {
  // Bindings e Segredos configurados no Cloudflare Dashboard ou wrangler secret
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string; // Token com permissão: Cloudflare Tunnel Write + DNS Edit
  CF_ZONE_ID: string;
  BASE_DOMAIN: string; // ex: "remote.nookapp.io"
  NOOK_PROVISIONING_KV: KVNamespace;
}

interface ProvisionRequest {
  installation_id: string; // UUID v4 gerado localmente na primeira execução
  machine_fingerprint_hash: string; // SHA-256 da máquina para evitar registros duplicados
  app_version: string;
}

interface RevokeRequest {
  installation_id: string;
  tunnel_id: string;
  revocation_token: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Nook-Signature',
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    try {
      if (url.pathname === '/health' && request.method === 'GET') {
        return Response.json(
          { status: 'ok', service: 'nook-mobile-provisioning', timestamp: Date.now() },
          { headers: CORS_HEADERS }
        );
      }

      if (url.pathname === '/api/tunnel/provision' && request.method === 'POST') {
        return await handleProvision(request, env);
      }

      if (url.pathname === '/api/tunnel/revoke' && request.method === 'POST') {
        return await handleRevoke(request, env);
      }

      return new Response('Not Found', { status: 404, headers: CORS_HEADERS });
    } catch (err: any) {
      console.error('Unhandled Worker Error:', err);
      return Response.json(
        { error: 'Internal Server Error', message: err?.message || 'Erro inesperado' },
        { status: 500, headers: CORS_HEADERS }
      );
    }
  },
};

/**
 * Provisiona um novo túnel nomeado Cloudflare e configura o roteamento DNS
 */
async function handleProvision(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as ProvisionRequest;
  const { installation_id, machine_fingerprint_hash, app_version } = body;

  if (!installation_id || !machine_fingerprint_hash) {
    return Response.json(
      { error: 'Parâmetros inválidos: installation_id e machine_fingerprint_hash são obrigatórios.' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // 1. Rate Limiting e Proteção contra Abuso via Cloudflare KV
  const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';
  const ipRateKey = `rate:ip:${clientIp}`;
  const ipRequests = Number(await env.NOOK_PROVISIONING_KV.get(ipRateKey)) || 0;

  if (ipRequests >= 5) {
    return Response.json(
      { error: 'Limite de solicitações de provisionamento excedido para este IP. Tente novamente mais tarde.' },
      { status: 429, headers: CORS_HEADERS }
    );
  }
  await env.NOOK_PROVISIONING_KV.put(ipRateKey, String(ipRequests + 1), { expirationTtl: 3600 });

  // 2. Verifica se a instalação já possui um túnel provisionado ativo
  const existingTunnelKey = `tunnel:${installation_id}`;
  const existingRecord = await env.NOOK_PROVISIONING_KV.get(existingTunnelKey, 'json') as any;

  if (existingRecord && existingRecord.tunnel_id && existingRecord.tunnel_token) {
    return Response.json(
      {
        success: true,
        reused: true,
        tunnel_id: existingRecord.tunnel_id,
        tunnel_token: existingRecord.tunnel_token,
        hostname: existingRecord.hostname,
        revocation_token: existingRecord.revocation_token,
      },
      { headers: CORS_HEADERS }
    );
  }

  // 3. Gera Segredo de 32 bytes criptograficamente seguro para o Túnel
  const tunnelSecretBytes = new Uint8Array(32);
  crypto.getRandomValues(tunnelSecretBytes);
  const tunnelSecret = btoa(String.fromCharCode(...tunnelSecretBytes));

  const tunnelName = `nook-${installation_id.slice(0, 8)}-${Date.now().toString(36)}`;

  // 4. Cria o Túnel via Cloudflare API
  const cfApiUrl = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/cfd_tunnel`;
  const cfCreateRes = await fetch(cfApiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: tunnelName,
      tunnel_secret: tunnelSecret,
    }),
  });

  const cfCreateData = (await cfCreateRes.json()) as any;
  if (!cfCreateRes.ok || !cfCreateData.success) {
    console.error('Falha ao criar Cloudflare Tunnel:', cfCreateData);
    return Response.json(
      { error: 'Falha ao provisionar túnel na Cloudflare API.', details: cfCreateData.errors },
      { status: 502, headers: CORS_HEADERS }
    );
  }

  const tunnelId = cfCreateData.result.id;
  const tunnelToken = cfCreateData.result.token;
  const hostname = `${installation_id.slice(0, 12)}.${env.BASE_DOMAIN}`;

  // 5. Configura a entrada DNS CNAME apontando para <tunnel_id>.cfargotunnel.com
  const dnsApiUrl = `https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/dns_records`;
  const dnsRes = await fetch(dnsApiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'CNAME',
      name: hostname,
      content: `${tunnelId}.cfargotunnel.com`,
      ttl: 1, // Automático
      proxied: true, // Protegido pelo Cloudflare Edge
    }),
  });

  const dnsData = (await dnsRes.json()) as any;
  const dnsRecordId = dnsData?.result?.id;

  // 6. Gera Token de Revogação Exclusivo
  const revocationBytes = new Uint8Array(24);
  crypto.getRandomValues(revocationBytes);
  const revocationToken = Array.from(revocationBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // 7. Salva metadados no Cloudflare KV
  const recordToSave = {
    installation_id,
    tunnel_id: tunnelId,
    tunnel_token: tunnelToken,
    hostname,
    dns_record_id: dnsRecordId,
    revocation_token: revocationToken,
    created_at: Date.now(),
    app_version,
  };
  await env.NOOK_PROVISIONING_KV.put(existingTunnelKey, JSON.stringify(recordToSave));

  return Response.json(
    {
      success: true,
      tunnel_id: tunnelId,
      tunnel_token: tunnelToken,
      hostname,
      revocation_token: revocationToken,
    },
    { headers: CORS_HEADERS }
  );
}

/**
 * Revoga e exclui um túnel e sua entrada DNS
 */
async function handleRevoke(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as RevokeRequest;
  const { installation_id, tunnel_id, revocation_token } = body;

  if (!installation_id || !tunnel_id || !revocation_token) {
    return Response.json(
      { error: 'Parâmetros incompletos para revogação.' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const existingTunnelKey = `tunnel:${installation_id}`;
  const record = (await env.NOOK_PROVISIONING_KV.get(existingTunnelKey, 'json')) as any;

  if (!record || record.tunnel_id !== tunnel_id || record.revocation_token !== revocation_token) {
    return Response.json(
      { error: 'Não autorizado: token de revogação inválido ou registro inexistente.' },
      { status: 403, headers: CORS_HEADERS }
    );
  }

  // 1. Remove registro DNS
  if (record.dns_record_id) {
    try {
      await fetch(
        `https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/dns_records/${record.dns_record_id}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${env.CF_API_TOKEN}` },
        }
      );
    } catch (e) {
      console.warn('Erro ao deletar registro DNS:', e);
    }
  }

  // 2. Exclui o Túnel na Cloudflare API
  try {
    await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/cfd_tunnel/${tunnel_id}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${env.CF_API_TOKEN}` },
      }
    );
  } catch (e) {
    console.warn('Erro ao deletar túnel:', e);
  }

  // 3. Limpa KV
  await env.NOOK_PROVISIONING_KV.delete(existingTunnelKey);

  return Response.json({ success: true, message: 'Túnel e registros revogados com sucesso.' }, { headers: CORS_HEADERS });
}

/**
 * Origens permitidas pelas Server Actions e pelo aviso cross-origin do
 * dev server.
 *
 * Cobre 3 cenários:
 *
 *   1. **Dev local + LAN**: descoberta automática dos IPv4 não-internos
 *      pra acessar o `next dev` de outros aparelhos da rede
 *      (`http://192.168.x.y:PORT`).
 *
 *   2. **Override manual**: env `DEV_ALLOWED_HOSTS` (CSV) — útil pra
 *      proxies/DNS locais (ex.: `meupc.local`).
 *
 *   3. **Produção**: domínios públicos do site são adicionados
 *      automaticamente:
 *        - `NEXT_PUBLIC_SITE_URL` (ex.: `https://www.privello.com.br`)
 *        - `RAILWAY_PUBLIC_DOMAIN` injetado pelo Railway (subdomínio
 *          gerado tipo `privello2-production-xxxx.up.railway.app`)
 *      Sem isso o Next 15 rejeita Server Actions atrás do proxy do
 *      Railway com mismatch de Origin/Host (a action falha silenciosa
 *      ou retorna erro genérico).
 *
 * Roda só no servidor (usa `node:os`).
 */

import os from "node:os";

/**
 * Porta atual (string), default 3000. Lida de `PORT` pra montar
 * `host:porta`.
 */
function porta(): string {
    const p = process.env.PORT?.trim();
    return p && p.length > 0 ? p : "3000";
}

/**
 * Lista os IPv4 não-internos das interfaces de rede. Vazio quando a
 * máquina só tem loopback (ex.: CI).
 */
export function lanIpv4Addresses(): string[] {
    const out: string[] = [];
    let ifaces: ReturnType<typeof os.networkInterfaces>;
    try {
        ifaces = os.networkInterfaces();
    } catch {
        return out;
    }
    for (const list of Object.values(ifaces)) {
        if (!list) continue;
        for (const net of list) {
            // `family` pode ser "IPv4" (string) ou 4 (number) conforme
            // a versão do Node — cobrimos ambos sem brigar com o tipo.
            const fam = net.family as string | number;
            const isV4 = fam === "IPv4" || fam === 4;
            if (isV4 && !net.internal) {
                out.push(net.address);
            }
        }
    }
    return out;
}

/**
 * Hosts manuais do env `DEV_ALLOWED_HOSTS` (CSV). Aceita `host` ou
 * `host:porta` — normalizamos pra incluir as duas formas.
 */
function hostsManuais(): string[] {
    const raw = process.env.DEV_ALLOWED_HOSTS?.trim();
    if (!raw) return [];
    return raw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}

/**
 * Extrai o host (sem protocolo, sem path) de uma URL. `null` quando a
 * entrada é inválida ou vazia.
 */
function hostFromUrl(value: string | undefined): string | null {
    if (!value) return null;
    try {
        const u = new URL(value);
        return u.host;
    } catch {
        return null;
    }
}

/**
 * Hosts de produção descobertos por env: domínio público configurado
 * (`NEXT_PUBLIC_SITE_URL`) e o subdomínio do Railway
 * (`RAILWAY_PUBLIC_DOMAIN`). Ambos são opcionais; sem eles, dev local
 * funciona normalmente.
 */
function hostsDeProducao(): string[] {
    const out: string[] = [];

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const siteHost = hostFromUrl(siteUrl);
    if (siteHost) out.push(siteHost);

    // Railway injeta automaticamente em runtime e build (com plano
    // pago) — é o domínio gerado tipo `xxx.up.railway.app`.
    const railway = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
    if (railway && railway.length > 0) out.push(railway);

    return out;
}

/**
 * Monta a lista completa de origens confiáveis: cada IP/host em
 * `host` e `host:porta`. Sem duplicatas.
 *
 * Usada tanto em `allowedDevOrigins` (aviso de cross-origin do Next
 * dev) quanto em `serverActions.allowedOrigins` (validação de
 * Server Actions, dev e prod).
 */
export function devAllowedOrigins(): string[] {
    const p = porta();
    const bases = new Set<string>();

    bases.add("localhost");
    bases.add("127.0.0.1");
    for (const ip of lanIpv4Addresses()) bases.add(ip);
    for (const h of hostsManuais()) bases.add(h);
    for (const h of hostsDeProducao()) bases.add(h);

    const out = new Set<string>();
    for (const b of bases) {
        out.add(b);
        // Só anexa porta quando o host ainda não a inclui.
        if (!b.includes(":")) out.add(`${b}:${p}`);
    }
    return Array.from(out);
}

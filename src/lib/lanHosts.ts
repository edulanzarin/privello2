/**
 * Descoberta de hosts da rede local (LAN) pra acesso multi-dispositivo.
 *
 * Quando o app roda em `npm run dev` / `next start` numa máquina e você
 * abre de outro aparelho da mesma rede (celular, tablet) via
 * `http://192.168.x.y:3000`, o Next precisa reconhecer essa origem como
 * confiável — tanto pro aviso de cross-origin do dev quanto pra
 * validação de Server Actions (que checam `Origin` vs `Host`).
 *
 * Este módulo monta a lista de hosts permitidos a partir de:
 *   1. IPs IPv4 não-internos das interfaces de rede (auto).
 *   2. `localhost` / `127.0.0.1`.
 *   3. Override manual via env `DEV_ALLOWED_HOSTS` (CSV) — útil quando
 *      há proxy/DNS local (ex.: `meupc.local`).
 *
 * Roda só no servidor (usa `node:os`). Em produção atrás de domínio
 * real isto é inócuo — o domínio entra via `DEV_ALLOWED_HOSTS` ou o
 * proxy já normaliza o Host.
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
 * Monta a lista completa de origens de dev confiáveis: cada IP/host
 * em `host` e `host:porta`. Sem duplicatas.
 *
 * Usada tanto em `allowedDevOrigins` (aviso de cross-origin do Next
 * dev) quanto em `serverActions.allowedOrigins` (validação de
 * Server Actions).
 */
export function devAllowedOrigins(): string[] {
    const p = porta();
    const bases = new Set<string>();

    bases.add("localhost");
    bases.add("127.0.0.1");
    for (const ip of lanIpv4Addresses()) bases.add(ip);
    for (const h of hostsManuais()) bases.add(h);

    const out = new Set<string>();
    for (const b of bases) {
        out.add(b);
        // Só anexa porta quando o host ainda não a inclui.
        if (!b.includes(":")) out.add(`${b}:${p}`);
    }
    return Array.from(out);
}

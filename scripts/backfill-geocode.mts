/**
 * Backfill de geocoding (T14) — preenche lat/lng dos perfis que
 * ainda não têm. Geocodifica via Nominatim com throttle de 1.1s
 * entre chamadas (política de uso do endpoint público).
 *
 * Uso: npx tsx scripts/backfill-geocode.mts
 */

import { PrismaClient } from "@prisma/client";

import { geocodificarAproximado } from "../src/lib/geocode";

const db = new PrismaClient();

async function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
    const perfis = await db.acompanhanteProfile.findMany({
        where: {
            perfilVisivel: true,
            planoVigente: { not: null },
            OR: [{ lat: null }, { lng: null }],
        },
        select: {
            userId: true,
            cidadeNome: true,
            estadoSigla: true,
            bairroNome: true,
        },
    });

    console.log(`Geocodificando ${perfis.length} perfis…`);
    let ok = 0;
    for (const p of perfis) {
        const coords = await geocodificarAproximado({
            cidadeNome: p.cidadeNome,
            estadoSigla: p.estadoSigla,
            bairroNome: p.bairroNome,
        });
        if (coords) {
            await db.acompanhanteProfile.update({
                where: { userId: p.userId },
                data: { lat: coords.lat, lng: coords.lng },
            });
            ok += 1;
            console.log(
                `  ✓ ${p.cidadeNome}/${p.estadoSigla} → ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`,
            );
        } else {
            console.log(`  ✗ ${p.cidadeNome}/${p.estadoSigla} — sem resultado`);
        }
        // Throttle pra respeitar a política do Nominatim (1 req/s).
        await sleep(1100);
    }
    console.log(`Pronto: ${ok}/${perfis.length} geocodificados.`);
    await db.$disconnect();
}

main().catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
});

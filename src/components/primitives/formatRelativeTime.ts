/**
 * Formata uma data como tempo relativo curto em pt-BR.
 *
 * Convenção do produto:
 *
 *   - `< 1min`         → `"agora"`
 *   - `< 60min`        → `"3min"`
 *   - `< 24h`          → `"5h"`
 *   - `< 7d`           → `"2d"`
 *   - `< 30d`          → `"3sem"`
 *   - `< 12meses`      → `"6m"`
 *   - default          → `"2a"`
 *
 * Mantido como helper sem dependência (sem `Intl.RelativeTimeFormat`)
 * porque o produto não precisa de localização e queremos rótulos
 * curtos otimizados para listagens densas (timestamp do
 * {@link import("./Comment").Comment} e do
 * {@link import("./MediaCarousel").MediaCarousel}).
 *
 * @param input Data ou ISO string.
 * @param now   Relógio injetável (testes). Default: `new Date()`.
 */
export function formatRelativeTime(
    input: Date | string,
    now: Date = new Date(),
): string {
    const date = input instanceof Date ? input : new Date(input);
    const diffMs = now.getTime() - date.getTime();
    if (!Number.isFinite(diffMs) || diffMs < 0) return "agora";

    const sec = Math.floor(diffMs / 1000);
    if (sec < 60) return "agora";

    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}min`;

    const hour = Math.floor(min / 60);
    if (hour < 24) return `${hour}h`;

    const day = Math.floor(hour / 24);
    if (day < 7) return `${day}d`;

    const week = Math.floor(day / 7);
    if (day < 30) return `${week}sem`;

    const month = Math.floor(day / 30);
    if (month < 12) return `${month}m`;

    const year = Math.floor(day / 365);
    return `${year}a`;
}

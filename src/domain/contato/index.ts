/**
 * Helpers de canais de contato (público facing).
 *
 * Centralizam a transformação de telefone (somente-dígitos, persistido
 * no banco) em links externos que aparecem no perfil público da
 * Acompanhante. Mantemos o número raw fora do payload RSC público —
 * só a URL formatada é serializada.
 */

/**
 * Constrói a URL do WhatsApp no padrão `wa.me/55<digits>` quando o
 * telefone é um número brasileiro válido (10 ou 11 dígitos com DDD).
 *
 * Retorna `null` quando o telefone está fora do formato esperado.
 * O caller (perfil público) consome `null` como "esconder o botão".
 *
 * Não inclui texto pré-preenchido pra que o visitante escreva a
 * abordagem natural — adicionar `?text=...` aqui é decisão futura
 * de produto.
 */
export function buildWhatsappUrl(telefoneDigits: string): string | null {
    const digits = telefoneDigits.replace(/\D/g, "");
    if (digits.length !== 10 && digits.length !== 11) return null;
    return `https://wa.me/55${digits}`;
}

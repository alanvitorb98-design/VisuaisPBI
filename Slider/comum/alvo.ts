/**
 * Descoberta do alvo de um filtro no modelo semantico.
 *
 * Sem dependencia de powerbi-* de proposito: e logica pura de string, e e
 * justamente a parte que ja errou em todos os tres visuais.
 */

export interface Alvo {
    table: string;
    column: string;
}

export type OrigemDoAlvo = "coluna" | "hierarquiaData" | "indeterminado";

export interface ResultadoAlvo {
    alvo: Alvo | null;
    origem: OrigemDoAlvo;
}

/**
 * Deriva tabela e coluna do queryName.
 *
 * O nome da coluna NUNCA sai de displayName: displayName e o rotulo exibido,
 * que o usuario pode renomear no painel de campos. Renomeado, o filtro
 * apontaria para uma coluna inexistente e o Power BI o descartaria sem avisar.
 *
 * Formatos:
 *   "Tabela.Coluna"                                   -> coluna arrastada direto
 *   "Tabela.Coluna.Variacao.Hierarquia.Nivel"         -> hierarquia de data
 *       automatica do Power BI. O nivel recebido e Ano (inteiro), mas a coluna
 *       base e a segunda parte, entao da para filtrar nela.
 *   "Tabela.Hierarquia.Nivel"                         -> hierarquia feita a mao:
 *       a segunda parte e o nome da hierarquia, nao de uma coluna, e nao ha
 *       como deduzir o que esta por baixo.
 *
 * `aceitarHierarquiaData` existe porque so o seletor de data sabe o que fazer
 * com a coluna base de uma variacao de data; para os outros isso seria um
 * palpite sem sentido.
 */
export function montarAlvo(queryName: string, aceitarHierarquiaData = false): ResultadoAlvo {
    const partes = (queryName || "").split(".");

    if (!partes[0] || !partes[1]) {
        return { alvo: null, origem: "indeterminado" };
    }

    if (partes.length === 2) {
        return { alvo: { table: partes[0], column: partes[1] }, origem: "coluna" };
    }

    if (partes.length === 5 && aceitarHierarquiaData) {
        return { alvo: { table: partes[0], column: partes[1] }, origem: "hierarquiaData" };
    }

    return { alvo: null, origem: "indeterminado" };
}

/**
 * PrimitiveValueType do powerbi-models e string | number | boolean: nao existe
 * valor de filtro que represente branco. Uma opcao para branco geraria a
 * condicao In ["null"], que nunca casa com o branco real do modelo, entao
 * essas linhas ficam de fora das listas.
 */
export function emBranco(valor: unknown): boolean {
    return valor === null || valor === undefined || valor === "";
}

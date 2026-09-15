/** Corte de rotulo quando nao cabe no espaco entre marcadores. */

/**
 * Quantos caracteres cabem em `largura`, estimando 0.55em por caractere.
 * Aproximacao suficiente para Segoe UI; medir de verdade exigiria o DOM.
 */
export function cabemEm(largura: number, tamanhoDaFonte: number): number {
    if (!isFinite(largura) || !isFinite(tamanhoDaFonte) || tamanhoDaFonte <= 0) {
        return 3;
    }
    return Math.max(3, Math.floor(largura / (tamanhoDaFonte * 0.55)));
}

/** Texto maior que `maximo` vira "texto…", contando as reticencias no limite. */
export function encurtar(texto: string, maximo: number): string {
    if (!texto || texto.length <= maximo) {
        return texto;
    }
    return texto.substring(0, Math.max(0, maximo - 1)) + "\u2026";
}

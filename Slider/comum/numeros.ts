/** Prende `valor` entre `minimo` e `maximo`. NaN e Infinity viram `minimo`. */
export function limitar(valor: number, minimo: number, maximo: number): number {
    if (!isFinite(valor)) {
        return minimo;
    }
    return Math.max(minimo, Math.min(maximo, valor));
}

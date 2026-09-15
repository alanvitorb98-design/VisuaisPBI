/**
 * Matematica de data e fuso do Seletor de Data.
 *
 * Tudo aqui trabalha em horario LOCAL. O bug que motivou este modulo foi usar
 * toISOString nos limites do filtro: ela devolve o mesmo instante em UTC, e num
 * fuso UTC-3 o inicio do dia local 00:00 vira 03:00Z. As datas do modelo
 * semantico nao tem fuso, entao ">= 03:00" descarta as linhas gravadas em
 * 00:00 e o dia inteiro fica de fora do filtro.
 */

export type Periodo = "hoje" | "sete" | "trinta" | "mes" | "ano" | "tudo" | "livre";

export interface Intervalo {
    de: Date;
    ate: Date;
}

export function inicioDoDia(base: Date): Date {
    return new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0);
}

export function fimDoDia(base: Date): Date {
    return new Date(base.getFullYear(), base.getMonth(), base.getDate(), 23, 59, 59, 999);
}

export function somarDias(base: Date, dias: number): Date {
    const copia = new Date(base.getTime());
    copia.setDate(copia.getDate() + dias);
    return copia;
}

export function mesmoDia(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
}

function dois(n: number): string {
    return String(n).padStart(2, "0");
}

/** "2026-09-15", para o value de um <input type="date">. */
export function paraCampo(data: Date): string {
    return data.getFullYear() + "-" + dois(data.getMonth() + 1) + "-" + dois(data.getDate());
}

/** Le o value de um <input type="date">. Devolve null se nao for uma data. */
export function doCampo(texto: string): Date {
    const partes = (texto || "").split("-").map(Number);
    if (partes.length !== 3 || partes.some(isNaN)) {
        return null;
    }
    return new Date(partes[0], partes[1] - 1, partes[2]);
}

/**
 * "2026-09-15T00:00:00.000" a partir dos componentes locais e SEM o sufixo Z.
 * Ver o comentario do topo: com Z o filtro perde o primeiro dia do intervalo.
 */
export function paraIsoLocal(data: Date): string {
    return data.getFullYear()
        + "-" + dois(data.getMonth() + 1)
        + "-" + dois(data.getDate())
        + "T" + dois(data.getHours())
        + ":" + dois(data.getMinutes())
        + ":" + dois(data.getSeconds())
        + "." + String(data.getMilliseconds()).padStart(3, "0");
}

/**
 * Intervalo de um preset. `hoje` entra por parametro em vez de new Date()
 * dentro da funcao para o calculo poder ser testado sem depender do relogio.
 * Devolve null para "tudo" e "livre", que nao sao calculaveis.
 */
export function calcularPeriodo(periodo: Periodo, agora: Date): Intervalo {
    const hoje = inicioDoDia(agora);

    switch (periodo) {
        case "hoje":
            return { de: hoje, ate: hoje };
        case "sete":
            return { de: somarDias(hoje, -6), ate: hoje };
        case "trinta":
            return { de: somarDias(hoje, -29), ate: hoje };
        case "mes":
            return { de: new Date(hoje.getFullYear(), hoje.getMonth(), 1), ate: hoje };
        case "ano":
            return { de: new Date(hoje.getFullYear(), 0, 1), ate: hoje };
        default:
            return null;
    }
}

/** Qual preset corresponde a um intervalo vindo do relatorio. */
export function reconhecerPeriodo(de: Date, ate: Date, agora: Date): Periodo {
    const candidatos: Periodo[] = ["hoje", "sete", "trinta", "mes", "ano"];
    for (const nome of candidatos) {
        const faixa = calcularPeriodo(nome, agora);
        if (faixa && mesmoDia(faixa.de, de) && mesmoDia(faixa.ate, ate)) {
            return nome;
        }
    }
    return "livre";
}

/** Datas invertidas viram um intervalo valido em vez de um intervalo vazio. */
export function ordenar(de: Date, ate: Date): Intervalo {
    return de.getTime() <= ate.getTime() ? { de: de, ate: ate } : { de: ate, ate: de };
}

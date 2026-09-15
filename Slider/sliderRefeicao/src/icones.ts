/**
 * Ícones das refeições - viewBox 24x24.
 *
 * IDs usados pelo visual.less:
 *   #raios  -> gira no hover
 *   #nucleo -> pulsa no hover
 *   #aura   -> respira no hover
 *   #lua    -> balança no hover
 *
 * O ícone é escolhido pelo NOME da refeição (ver iconePara), não pela posição.
 * Nome desconhecido cai no GENERICO, que herda a cor da categoria via currentColor.
 */

const RAIOS = `
  <g id="raios">
    <rect x="11.1" y="0.5"  width="1.8" height="3.6" rx="0.9"/>
    <rect x="11.1" y="19.9" width="1.8" height="3.6" rx="0.9"/>
    <rect x="0.5"  y="11.1" width="3.6" height="1.8" rx="0.9"/>
    <rect x="19.9" y="11.1" width="3.6" height="1.8" rx="0.9"/>
    <rect x="11.1" y="0.5"  width="1.8" height="3.6" rx="0.9" transform="rotate(45 12 12)"/>
    <rect x="11.1" y="19.9" width="1.8" height="3.6" rx="0.9" transform="rotate(45 12 12)"/>
    <rect x="0.5"  y="11.1" width="3.6" height="1.8" rx="0.9" transform="rotate(45 12 12)"/>
    <rect x="19.9" y="11.1" width="3.6" height="1.8" rx="0.9" transform="rotate(45 12 12)"/>
  </g>`;

/* 1. DESJEJUM MANHÃ - sol com a metade de baixo mais escura */
export const DESJEJUM_MANHA = `
<g fill="#F2AC33">
  <g id="nucleo">
    <circle cx="12" cy="12" r="6.4"/>
    <path d="M5.6 12a6.4 6.4 0 0 0 12.8 0z" fill="#D69B31"/>
  </g>
</g>`;

/* 2. ALMOÇO - sol cheio, cor chapada, com aura */
export const ALMOCO = `
<g fill="#F0B911">
  <g id="aura">
    <circle cx="12" cy="12" r="10.2" opacity="0.10"/>
    <circle cx="12" cy="12" r="8.3"  opacity="0.16"/>
  </g>
  ${RAIOS}
  <g id="nucleo">
    <circle cx="12" cy="12" r="6.4"/>
  </g>
</g>`;

/* 3. DESJEJUM TARDE - mesmo sol, tom uniformemente mais fechado */
export const DESJEJUM_TARDE = `
<g fill="#FF8000">
  ${RAIOS}
  <g id="nucleo">
    <circle cx="12" cy="12" r="6.4"/>
  </g>
</g>`;

/* 4. JANTAR - lua com lado escuro e crescente branco */
export const JANTAR = `
<g id="lua">
  <circle cx="12" cy="12" r="8.6" fill="#EBE9E8"/>
  <g opacity="0.22" fill="#000000">
    <circle cx="9.1"  cy="9.4"  r="1.9"/>
    <circle cx="14.6" cy="13.3" r="1.4"/>
    <circle cx="10.2" cy="15.1" r="1.1"/>
  </g>
  <path d="M12 3.4 A8.6 8.6 0 1 0 12 20.6 A12.5 12.5 0 0 1 12 3.4 Z" fill="currentColor" opacity="0.2"/>
  <circle cx="12" cy="12" r="8.6" fill="none" stroke="#D1CDCD" stroke-width="0.9"/>
</g>`;

/* 5. CEIA - lua cheia */
export const CEIA = `
<g id="lua" fill="#D1CDCD">
  <circle cx="12" cy="12" r="8.6"/>
  <g opacity="0.22" fill="#000000">
    <circle cx="9.1"  cy="9.4"  r="1.9"/>
    <circle cx="14.6" cy="13.3" r="1.4"/>
    <circle cx="10.2" cy="15.1" r="1.1"/>
  </g>
  <circle cx="12" cy="12" r="8.6" fill="none" stroke="#D1CDCD" stroke-width="0.9"/>
</g>`;

/* 6. GENERICO - prato e talher, para refeições fora da lista conhecida */
export const GENERICO = `
<g id="nucleo" fill="currentColor">
  <circle cx="12" cy="12" r="8.6" opacity="0.18"/>
  <circle cx="12" cy="12" r="5.2" opacity="0.55"/>
  <rect x="2.6" y="4.2" width="1.5" height="15.6" rx="0.75"/>
  <rect x="19.9" y="4.2" width="1.5" height="15.6" rx="0.75"/>
</g>`;

/** Minúsculas, sem acento, sem pontuação, espaços colapsados. */
function normalizar(texto: string): string {
    return texto
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

interface Regra {
    termos: string[];
    icone: string;
}

/** Casam primeiro: expressões compostas, que são inequívocas. */
const REGRAS_FORTES: Regra[] = [
    { termos: ["desjejum manha", "cafe da manha", "cafe manha", "matinal"], icone: DESJEJUM_MANHA },
    { termos: ["desjejum tarde", "lanche da tarde", "lanche tarde", "vespertino", "merenda"], icone: DESJEJUM_TARDE },
    { termos: ["almoco", "lunch"], icone: ALMOCO },
    { termos: ["jantar", "janta", "dinner"], icone: JANTAR },
    { termos: ["ceia", "madrugada", "noturno"], icone: CEIA }
];

/** Só valem se nenhuma regra forte casar. */
const REGRAS_FRACAS: Regra[] = [
    { termos: ["manha", "cafe", "breakfast"], icone: DESJEJUM_MANHA },
    { termos: ["tarde", "lanche", "snack"], icone: DESJEJUM_TARDE },
    { termos: ["noite", "night"], icone: JANTAR }
];

/**
 * Devolve a fonte SVG do ícone correspondente ao nome da refeição.
 * Nome não reconhecido devolve GENERICO.
 */
export function iconePara(nome: string): string {
    const alvo = normalizar(nome);
    if (!alvo) {
        return GENERICO;
    }

    for (const regra of REGRAS_FORTES) {
        if (regra.termos.some(termo => alvo.indexOf(termo) >= 0)) {
            return regra.icone;
        }
    }

    for (const regra of REGRAS_FRACAS) {
        if (regra.termos.some(termo => alvo.indexOf(termo) >= 0)) {
            return regra.icone;
        }
    }

    return GENERICO;
}

const NS_SVG = "http://www.w3.org/2000/svg";
const CACHE: Record<string, Element> = {};

/**
 * Converte a fonte do ícone em nós SVG reais.
 *
 * Usa DOMParser em vez de innerHTML: a regra de lint no-implied-inner-html
 * proíbe escrever HTML por string, e sem isso o visual não passa na
 * certificação do AppSource. Cada fonte é parseada uma única vez e o
 * resultado fica em cache; quem chama recebe sempre um clone.
 */
export function nosDoIcone(fonte: string): Element {
    if (!CACHE[fonte]) {
        const documento = new DOMParser().parseFromString(
            "<svg xmlns=\"" + NS_SVG + "\">" + fonte + "</svg>",
            "image/svg+xml"
        );
        CACHE[fonte] = documento.documentElement.firstElementChild;
    }
    return CACHE[fonte].cloneNode(true) as Element;
}

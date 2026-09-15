/**
 * Ícones das refeições - viewBox 24x24.
 *
 * Desenho: duotone geométrico, tudo em currentColor. O visual define
 * `color` no grupo do ícone com a cor da categoria, então cada refeição
 * herda a cor da paleta (amarelo -> laranja -> terracota -> roxo -> azul),
 * o que mantém a leitura de manhã para noite sem repetir o mesmo desenho.
 *
 * Cada refeição tem uma silhueta própria, não só uma cor diferente:
 *   xícara / prato com talher / biscoito / cloche / lua.
 *
 * IDs usados pelo visual.less para animar no hover:
 *   #vapor  -> sobe e some
 *   #nucleo -> pulsa
 *   #aura   -> respira
 *   #cloche -> levanta
 *   #lua    -> balança
 */

/* 1. DESJEJUM MANHÃ - xícara de café com vapor */
export const DESJEJUM_MANHA = `
<g fill="currentColor">
  <g id="vapor" opacity="0.5">
    <path d="M9.3 8.4c-1.1-1.2-1.1-2.4 0-3.6.8-.9.9-1.7.3-2.4"
          fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M13.5 8.4c-1.1-1.2-1.1-2.4 0-3.6.8-.9.9-1.7.3-2.4"
          fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
  </g>
  <g>
    <path d="M4.9 10.4h12.1v3.7a6.05 6.05 0 0 1-12.1 0z"/>
    <path d="M17.5 11.4a2.9 2.9 0 0 1 0 5.4"
          fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity="0.55"/>
  </g>
  <rect x="3.9" y="20.6" width="16.2" height="1.9" rx="0.95" opacity="0.32"/>
</g>`;

/* 2. ALMOÇO - prato visto de cima, entre garfo e faca */
export const ALMOCO = `
<g fill="currentColor">
  <g id="aura" opacity="0.26">
    <circle cx="12" cy="12" r="9.2"/>
  </g>
  <g>
    <circle cx="12" cy="12" r="6.6" opacity="0.5"/>
    <circle cx="12" cy="12" r="3.3"/>
  </g>
  <g opacity="0.85">
    <rect x="1.1" y="2.6" width="0.9" height="4.6" rx="0.45"/>
    <rect x="2.75" y="2.6" width="0.9" height="4.6" rx="0.45"/>
    <rect x="4.4" y="2.6" width="0.9" height="4.6" rx="0.45"/>
    <rect x="1.1" y="6.6" width="4.2" height="2" rx="1"/>
    <rect x="2.45" y="8.2" width="1.5" height="13.2" rx="0.75"/>
    <rect x="19.6" y="2.6" width="2.4" height="8.4" rx="1.2"/>
    <rect x="20.05" y="10.2" width="1.5" height="11.2" rx="0.75"/>
  </g>
</g>`;

/* 3. DESJEJUM TARDE - biscoito com gotas de chocolate */
export const DESJEJUM_TARDE = `
<g fill="currentColor">
  <g id="nucleo">
    <circle cx="12" cy="12" r="8.9"/>
  </g>
  <g fill="#000000" opacity="0.26">
    <circle cx="9" cy="8.9" r="1.7"/>
    <circle cx="15.2" cy="11.3" r="1.35"/>
    <circle cx="10.4" cy="15.4" r="1.5"/>
    <circle cx="15.1" cy="16.2" r="0.95"/>
    <circle cx="6.9" cy="12.6" r="0.9"/>
  </g>
</g>`;

/* 4. JANTAR - cloche sobre o prato */
export const JANTAR = `
<g fill="currentColor">
  <g id="cloche">
    <path d="M3.6 15.6a8.4 8.4 0 0 1 16.8 0z"/>
    <circle cx="12" cy="5.7" r="1.6"/>
  </g>
  <rect x="1.9" y="16.6" width="20.2" height="2.2" rx="1.1" opacity="0.42"/>
  <rect x="5.2" y="19.6" width="13.6" height="1.7" rx="0.85" opacity="0.22"/>
</g>`;

/* 5. CEIA - lua crescente com estrelas */
export const CEIA = `
<g fill="currentColor">
  <g id="lua">
    <path d="M20.1 15.3A8.7 8.7 0 0 1 8.9 4.1a8.7 8.7 0 1 0 11.2 11.2z"/>
  </g>
  <g opacity="0.45">
    <path d="M18.4 2.4l.62 1.68 1.68.62-1.68.62-.62 1.68-.62-1.68-1.68-.62 1.68-.62z"/>
    <circle cx="14.9" cy="7.5" r="0.85"/>
    <circle cx="21.3" cy="9.4" r="0.6"/>
  </g>
</g>`;

/* 6. GENERICO - prato vazio, para refeições fora da lista conhecida */
export const GENERICO = `
<g id="nucleo" fill="currentColor">
  <circle cx="12" cy="12" r="9" opacity="0.26"/>
  <circle cx="12" cy="12" r="5.3" opacity="0.6"/>
</g>`;

/** Minúsculas, sem acento, sem pontuação, espaços colapsados. */
function normalizar(texto: string): string {
    return texto
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
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

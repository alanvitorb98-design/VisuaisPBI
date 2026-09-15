/**
 * Ícones das refeições - viewBox 24x24
 * Desenhados para renderizar em branco sobre a cor da alça.
 * "Mais escuro" = opacidade reduzida sobre o branco.
 *
 * IDs usados pelo visual.less:
 *   #raios  -> gira no hover
 *   #nucleo -> pulsa no hover
 *   #aura   -> respira no hover
 *   #lua    -> balança no hover
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

/* 1. DESJEJUM MANHÃ — sol com a metade de baixo mais escura */
export const DESJEJUM_MANHA = `
<g fill="#F2AC33">
  <g id="nucleo">
    <circle cx="12" cy="12" r="6.4"/>
    <path d="M5.6 12a6.4 6.4 0 0 0 12.8 0z" fill="#D69B31"/>
  </g>
</g>`;

/* 2. ALMOÇO — sol cheio, cor chapada, com aura */
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

/* 3. DESJEJUM TARDE — mesmo sol, tom uniformemente mais fechado */
export const DESJEJUM_TARDE = `
<g fill="#FF8000">
  ${RAIOS}
  <g id="nucleo">
    <circle cx="12" cy="12" r="6.4"/>
  </g>
</g>`;

/* 4. JANTAR — lua com lado escuro e crescente branco */
export const JANTAR = `
<g id="lua">
  <circle cx="12" cy="12" r="8.6" fill="#EBE9E8"/>
  <g opacity="0.22" fill="#000000">
    <circle cx="9.1"  cy="9.4"  r="1.9"/>
    <circle cx="14.6" cy="13.3" r="1.4"/>
    <circle cx="10.2" cy="15.1" r="1.1"/>
  </g>
  <path d="M12 3.4 A8.6 8.6 0 1 0 12 20.6 A12.5 12.5 0 0 1 12 3.4 Z" fill="currentColor" opacity="0.2"/>
  <circle cx="12" cy="12" r="8.6" fill="none" stroke="#D1CDCD" stroke-width="0.9" />
  
</g>`;

/* 5. CEIA — lua cheia */
export const CEIA = `
<g id="lua" fill="#D1CDCD">
  <circle cx="12" cy="12" r="8.6"/>
  <g opacity="0.22" fill="#000000">
    <circle cx="9.1"  cy="9.4"  r="1.9"/>
    <circle cx="14.6" cy="13.3" r="1.4"/>
    <circle cx="10.2" cy="15.1" r="1.1"/>
  </g>
  <circle cx="12" cy="12" r="8.6" fill="none" stroke="#D1CDCD" stroke-width="0.9" />
</g>`;

export const ICONES = [
  DESJEJUM_MANHA,   // 1
  ALMOCO,           // 2
  DESJEJUM_TARDE,   // 3
  JANTAR,           // 4
  CEIA              // 5
];

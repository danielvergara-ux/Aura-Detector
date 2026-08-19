import type { AuraTierId, RandomSource } from '@/types/aura';

/**
 * All user-facing flavour text lives here. Tone: internet, seco, exagerado.
 * Never corporate. Never scientific. Never about the person's appearance.
 */

export const DISCLAIMER_SHORT =
  'Resultados ficticios. Puro entretenimiento.';

export const DISCLAIMER_FULL =
  'Los resultados son ficticios y generados únicamente con fines de entretenimiento. ' +
  'Aura Scanner no realiza análisis biométricos, psicológicos ni científicos reales.';

export const PRIVACY_SHORT =
  '🔒 Tu cámara se procesa localmente. No almacenamos tu rostro.';

/** Rotating technical-sounding nonsense shown during the scan. */
export const SCAN_TICKER: readonly string[] = [
  'Detectando presencia...',
  'Leyendo vibraciones...',
  'Calculando presencia social...',
  'Analizando energía inexplicable...',
  'Midiendo aura residual...',
  'Buscando momentos canon...',
  'Comprobando nivel de protagonista...',
  'Analizando índice de sigma...',
  'Cruzando datos con el multiverso...',
  'Consultando al consejo de aura...',
  'Recalibrando por exceso de presencia...',
  'Esto está tardando más de lo normal 💀',
  'La máquina está juzgándote.',
  'Calculando aura final...',
];

/** Guidance while framing the face. Short. Impatient. */
export const CAMERA_HINTS = {
  searching: 'Ponte dentro del círculo',
  tooFar: 'Acércate un poco bro',
  offCenter: 'Céntrate en el círculo',
  detected: 'NO TE MUEVAS',
  locked: 'ROSTRO DETECTADO',
  starting: 'INICIANDO ANÁLISIS DE AURA',
} as const;

export const LOADING_LABELS: readonly string[] = [
  'SCANNING...',
  'CALIBRATING...',
  'DETECTING...',
  'AURA SYNC...',
  'BOOTING SCANNER...',
];

export const ERROR_COPY = {
  cameraUnavailable: {
    title: 'Tu cámara decidió perder aura.',
    body: 'No pudimos acceder a la cámara. Revisa los permisos y vuelve a intentar.',
    action: 'Intentar nuevamente',
  },
  cameraDenied: {
    title: 'La cámara dijo que no.',
    body: 'Necesitamos la cámara solo para la animación del escáner. Nada sale de tu teléfono.',
    action: 'Intentar nuevamente',
  },
  noFace: {
    title: 'Bro necesito que pongas la cara 💀',
    body: 'No detectamos a nadie frente a la cámara.',
    action: 'Reintentar',
  },
  timeout: {
    title: 'El scanner perdió tu presencia.',
    body: 'Tardaste demasiado y el aura se enfrió.',
    action: 'Volver a escanear',
  },
  server: {
    title: 'El medidor de aura explotó.',
    body: 'Algo falló de nuestro lado. Inténtalo otra vez.',
    action: 'Reintentar',
  },
  rateLimited: {
    title: 'Calma. El aura necesita reposar.',
    body: 'Has escaneado demasiadas veces. Espera un momento y vuelve.',
    action: 'Entendido',
  },
  paymentRejected: {
    title: 'El destino se negó a ser alterado.',
    body: 'El pago no se completó. No se te cobró nada.',
    action: 'Intentar de nuevo',
  },
  notFound: {
    title: 'Esa aura no existe.',
    body: 'El resultado que buscas se desvaneció.',
    action: 'Escanear la mía',
  },
} as const;

/** Result blurbs by tier. One is picked at random per scan. */
const TIER_LINES: Record<AuraTierId, readonly string[]> = {
  negative: [
    'Bro perdió aura abriendo la página.',
    'Entraste y el servidor se puso incómodo.',
    'Nah 💀',
    'El escáner pidió disculpas después de esto.',
    'Aura en números rojos. Literal.',
  ],
  npc: [
    'NPC certificado.',
    'Caminas de fondo en la vida de alguien más.',
    'El escáner casi ni te ve.',
    'Presencia: opcional.',
    'Diálogo repetitivo detectado.',
  ],
  civil: [
    'Existe aura. Técnicamente.',
    'Aura de persona que saluda en el elevador.',
    'Estás en la media. Peligrosamente en la media.',
    'Aura suficiente para sobrevivir el lunes.',
    'Aura funcional. Nada más.',
  ],
  protagonist: [
    'Bro empezó su arco argumental.',
    'La cámara te empezó a seguir sola.',
    'Aura de capítulo 3, temporada 1.',
    'Alguien está escribiendo tu historia.',
    'Se activó la música de fondo.',
  ],
  main_character: [
    'La cámara ya sabía quién eras.',
    'Entraste y todos voltearon. Nadie sabe por qué.',
    'Aura de protagonista con presupuesto.',
    'El servidor sintió tu presencia.',
    'Te ves bien incluso en 240p.',
  ],
  legend: [
    'Presencia peligrosa detectada.',
    'Entraste y la cámara se puso nerviosa.',
    'Aura documentada en tres continentes.',
    'La gente cuenta anécdotas tuyas y ni estabas ahí.',
    'Le robaste el protagonismo a alguien hoy.',
  ],
  absurd: [
    'Esto empieza a ser preocupante.',
    'El escáner pidió refuerzos.',
    'Aura ilegal en cuatro países.',
    'ABSOLUTE AURA.',
    'Nadie debería tener tanto de esto.',
  ],
  god: [
    'EL ESCÁNER NO ESTABA PREPARADO PARA TI',
    'Los sensores se derritieron. Todo bien.',
    'Esto no debería ser posible.',
    'El aura te tiene a ti, no tú a ella.',
    'La máquina se apagó en señal de respeto.',
  ],
};

export function getAuraMessage(tierId: AuraTierId, random: RandomSource): string {
  const lines = TIER_LINES[tierId];
  const index = Math.floor(random() * lines.length);
  return lines[Math.min(index, lines.length - 1)] as string;
}

/** Every line for a tier — used by tests and the share card generator. */
export function getTierLines(tierId: AuraTierId): readonly string[] {
  return TIER_LINES[tierId];
}

export const SHARE_COPY = {
  headline: 'MI AURA',
  cta: '¿CUÁNTA AURA TIENES?',
  challengeTitle: (nickname: string, score: number) =>
    `${nickname} consiguió ${score.toLocaleString('es-MX')} de aura.`,
  challengeSubtitle: '¿Puedes superarlo?',
  challengeCta: 'ACEPTAR EL RETO',
  win: 'Le robaste el protagonismo.',
  lose: 'Se quedó con el arco argumental.',
  tie: 'Empate cósmico. Incómodo para ambos.',
  copied: 'Link copiado',
  rerollTitle: '¿NO TE GUSTÓ TU AURA?',
  rerollCta: 'ALTERAR EL DESTINO',
  rerollPaid: 'EL DESTINO HA SIDO ALTERADO',
  rerollPaidCta: 'VOLVER A MEDIR MI AURA',
  rerollNote: 'Bro realmente pagó para cambiar su destino.',
} as const;

/** Anonymous display names. Assembled as `${adj}_${noun}${digits}`. */
export const NICKNAME_PARTS = {
  adjectives: [
    'sigma', 'npc', 'aura', 'canon', 'lowkey', 'ultra', 'mega', 'cursed',
    'silent', 'random', 'final', 'quantum', 'holy', 'broken', 'shadow',
  ],
  nouns: [
    'destroyer', 'protagonista', 'boss', 'entity', 'legend', 'ghost',
    'enjoyer', 'moment', 'anomaly', 'unit', 'gremlin', 'oracle', 'goblin',
  ],
} as const;

import type { Metadata } from 'next';
import Link from 'next/link';
import { DISCLAIMER_FULL } from '@/content/aura-copy';

export const metadata: Metadata = {
  title: 'Privacidad y disclaimer',
  description:
    'Cómo funciona Aura Scanner: resultados ficticios, cámara procesada localmente, sin almacenar rostros.',
  alternates: { canonical: '/legal' },
};

const SECTIONS = [
  {
    title: 'Esto es entretenimiento',
    body: [
      DISCLAIMER_FULL,
      'La puntuación se genera con un sistema de probabilidades aleatorio. No mide personalidad, inteligencia, atractivo, salud ni ninguna otra característica real.',
    ],
  },
  {
    title: 'Qué hace la cámara',
    body: [
      'La cámara se usa únicamente para la animación del escáner. El video se procesa en tu dispositivo, dentro del navegador.',
      'No se graban ni almacenan fotografías. No se envían imágenes ni fotogramas a ningún servidor. No se realiza reconocimiento de identidad ni se guardan datos biométricos.',
      'La detección solo comprueba si hay un rostro aproximadamente centrado en el encuadre, y esa señal no influye en el resultado.',
    ],
  },
  {
    title: 'Qué guardamos',
    body: [
      'Un identificador anónimo aleatorio en una cookie, para asociar tus escaneos y tus créditos de reroll.',
      'La puntuación, la categoría y la fecha de cada escaneo. Un apodo, si eliges uno.',
      'Para los pagos: el identificador de la transacción, el monto, la moneda y el estado. No recibimos ni almacenamos datos de tu tarjeta; el cobro lo procesa Mercado Pago.',
      'Para limitar abusos guardamos un conteo asociado a un hash irreversible de tu IP. La IP en sí no se almacena.',
    ],
  },
  {
    title: 'Pagos',
    body: [
      'El reroll es un pago opcional que otorga un intento adicional. No compra un resultado concreto: el nuevo número se genera con el mismo sistema aleatorio.',
      'Los pagos se verifican en el servidor contra Mercado Pago. Cada pago aprobado otorga exactamente un crédito, que se consume una sola vez.',
    ],
  },
  {
    title: 'Menores y contenido',
    body: [
      'La app no está dirigida a menores de 13 años. No solicitamos nombre real, correo, ubicación ni contactos.',
      'Los apodos se filtran a un conjunto reducido de caracteres y se limitan en longitud.',
    ],
  },
];

export default function LegalPage() {
  return (
    <main className="relative min-h-screen-dvh px-5 py-8 safe-top safe-bottom">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="font-display text-[10px] font-bold uppercase tracking-[0.3em] text-white/60"
          >
            ← AURA<span className="text-aura">/</span>SCANNER
          </Link>
          <Link href="/scan" className="hud-label hover:text-white">
            Escanear →
          </Link>
        </header>

        <div>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight aura-gradient-text">
            Privacidad y disclaimer
          </h1>
          <p className="hud-label mt-2">Lo importante, sin letra chiquita</p>
        </div>

        <div className="flex flex-col gap-6">
          {SECTIONS.map((section) => (
            <section key={section.title} className="hud-panel px-5 py-5">
              <h2 className="font-display text-sm font-bold uppercase tracking-[0.16em] text-aura">
                {section.title}
              </h2>
              <div className="mt-3 flex flex-col gap-3">
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-relaxed text-white/75">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <Link href="/scan" className="btn-primary self-start">
          ESCANEAR MI AURA
        </Link>
      </div>
    </main>
  );
}

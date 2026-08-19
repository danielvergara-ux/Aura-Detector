# Aura Scanner

> ¿Cuánta aura tienes? La cámara no miente. Probablemente.

Experiencia web viral, mobile-first: la persona abre el sitio, permite la cámara, una máquina absurda finge analizar su rostro durante unos segundos y le escupe un número de **aura**. Después puede compartirlo, retar a alguien, competir en el ranking y —si el destino no le gustó— pagar por otro intento.

> **Los resultados son ficticios y generados únicamente con fines de entretenimiento. Aura Scanner no realiza análisis biométricos, psicológicos ni científicos reales.**

---

## Índice

- [Requisitos](#requisitos)
- [Instalación](#instalación)
- [Desarrollo](#desarrollo)
- [Variables de entorno](#variables-de-entorno)
- [Supabase setup](#supabase-setup)
- [Mercado Pago setup](#mercado-pago-setup)
- [Webhook setup](#webhook-setup)
- [Testing](#testing)
- [Deploy en Vercel](#deploy-en-vercel)
- [Arquitectura](#arquitectura)
- [Motor de aura](#motor-de-aura)
- [Seguridad](#seguridad)
- [Privacidad](#privacidad)
- [Personalización](#personalización)

---

## Requisitos

| Herramienta | Versión |
| --- | --- |
| Node.js | ≥ 20 |
| npm | ≥ 10 |
| Navegador | Cualquiera con `getUserMedia` (Chrome, Safari 15+, Firefox) |

Para probar la cámara desde un teléfono necesitas **HTTPS o `localhost`**: los navegadores no entregan `getUserMedia` en orígenes inseguros. Ver [Probar en un teléfono](#probar-en-un-teléfono).

---

## Instalación

```bash
npm install
cp .env.example .env.local   # opcional para desarrollo
```

---

## Desarrollo

```bash
npm run dev        # http://localhost:3000
npm run lint       # ESLint (next/core-web-vitals)
npm run typecheck  # tsc --noEmit, modo strict
npm run test       # Vitest
npm run build      # build de producción
npm start          # sirve el build
npm run icons      # regenera los iconos PWA
```

**La app arranca sin configurar nada.** Sin Supabase usa un almacén en memoria; sin Mercado Pago usa un checkout simulado. Es lo que permite probar el flujo completo (escaneo → resultado → reroll pagado → nuevo resultado) desde el primer `npm run dev`.

En cuanto agregues credenciales reales, ambos fallbacks se apagan solos.

### Probar en un teléfono

```bash
npm run dev
npx localtunnel --port 3000    # o ngrok http 3000
```

Abre la URL HTTPS que te devuelva. Añade esa URL a `NEXT_PUBLIC_APP_URL` si vas a probar pagos.

---

## Variables de entorno

Todas están documentadas en [`.env.example`](.env.example).

| Variable | Ámbito | Obligatoria | Descripción |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | público | recomendada | URL base. En Vercel se infiere de `VERCEL_URL`. |
| `NEXT_PUBLIC_SUPABASE_URL` | público | producción | URL del proyecto Supabase. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | público | producción | Clave anónima (solo lee el leaderboard). |
| `SUPABASE_SERVICE_ROLE_KEY` | **servidor** | producción | Ignora RLS. Nunca la expongas. |
| `MERCADO_PAGO_ACCESS_TOKEN` | **servidor** | pagos | Token privado de Mercado Pago. |
| `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY` | público | no | Solo si más adelante agregas Checkout Bricks. |
| `MERCADO_PAGO_WEBHOOK_SECRET` | **servidor** | pagos | Firma de webhooks. **En producción sin ella los webhooks se rechazan.** |
| `REROLL_PRICE` | servidor | pagos | Precio real cobrado. El cliente jamás lo define. |
| `REROLL_CURRENCY` | servidor | pagos | `MXN`, `ARS`, `BRL`, … |
| `NEXT_PUBLIC_REROLL_DISPLAY_PRICE` | público | no | Texto del botón. Puramente cosmético. |
| `NEXT_PUBLIC_FACE_MODEL_URL` | público | no | Para auto-hospedar el modelo de detección. |
| `NEXT_PUBLIC_MEDIAPIPE_WASM_PATH` | público | no | Para auto-hospedar el runtime wasm. |

Regla de oro: **si no lleva `NEXT_PUBLIC_`, no puede tocar el bundle del cliente.** Los secretos solo se leen en `lib/utils/env.ts`, y los módulos que los usan están marcados con `server-only`.

---

## Supabase setup

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Copia `Project URL`, `anon key` y `service_role key` a `.env.local`.
3. Ejecuta la migración:

   **Opción A — SQL Editor:** pega el contenido de `supabase/migrations/0001_init.sql` y ejecútalo.

   **Opción B — CLI:**
   ```bash
   npx supabase link --project-ref <tu-ref>
   npx supabase db push
   ```

La migración crea `sessions`, `aura_scans`, `payments`, `reroll_credits`, `rate_events`, la vista `leaderboard` y la función atómica `consume_reroll_credit()`.

**RLS:** está activado en todas las tablas y **sin políticas** para `anon`, es decir: el navegador no puede leer ni escribir nada directamente. Lo único público es la vista `leaderboard`. Todas las escrituras pasan por el servidor con la service role key.

Opcional — limpieza periódica de contadores anti-abuso, si tienes `pg_cron`:

```sql
select cron.schedule('prune-aura-rate-events', '17 * * * *', $$select public.prune_rate_events()$$);
```

---

## Mercado Pago setup

1. Entra a [Tus integraciones](https://www.mercadopago.com/developers/panel) y crea una aplicación de tipo **Pagos online → Checkout Pro**.
2. Copia el **Access Token** (usa el de *prueba* mientras desarrollas) a `MERCADO_PAGO_ACCESS_TOKEN`.
3. Define `REROLL_PRICE` y `REROLL_CURRENCY` según tu país.
4. Para probar cobros usa las [tarjetas de prueba](https://www.mercadopago.com.mx/developers/es/docs/checkout-pro/additional-content/test-cards) y un usuario comprador de prueba.

Flujo implementado:

```
POST /api/payments/reroll
  → crea fila `payments` (pending)
  → crea preferencia (idempotency key = payment.id, external_reference = payment.id)
  → devuelve init_point
usuario paga en Mercado Pago
  → webhook  → verifica firma → consulta la API → aprueba → otorga 1 crédito
  → redirect → /reroll/return → poll a /api/payments/:id (que también reconcilia)
```

El `success_url` **no** otorga nada. El crédito solo se emite cuando el servidor confirma el estado contra la API de Mercado Pago.

---

## Webhook setup

1. En el panel de Mercado Pago → **Webhooks**, registra:

   ```
   https://TU-DOMINIO/api/mercado-pago/webhook
   ```

   Eventos: **Pagos** (`payment`). Opcionalmente `merchant_order`.

2. Copia la **clave secreta** que te muestra el panel a `MERCADO_PAGO_WEBHOOK_SECRET`.

3. Para desarrollo local expón tu puerto (`ngrok http 3000`) y usa esa URL. Si no puedes recibir webhooks, no pasa nada: `/api/payments/:id` reconcilia consultando la API directamente cuando el pago sigue pendiente.

**Verificación de firma:** se calcula `HMAC-SHA256` sobre el manifiesto `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` y se compara en tiempo constante contra `v1` del header `x-signature`. En producción, sin secreto configurado, **el endpoint rechaza todo** (401).

---

## Testing

```bash
npm run test
```

Cubre:

- generación de puntuaciones y forma de la distribución (`tests/aura-engine.test.ts`)
- límites de tiers y continuidad de rangos
- rarezas y easter eggs (`tests/easter-eggs.test.ts`)
- consumo de rerolls: uno y solo uno, incluso con peticiones concurrentes (`tests/reroll.test.ts`)
- webhooks: firma válida/inválida, idempotencia, manipulación de monto, topics ignorados (`tests/webhook.test.ts`)
- saneamiento de nicknames y logros (`tests/nickname.test.ts`)

---

## Deploy en Vercel

1. Importa el repositorio en Vercel.
2. Carga todas las variables de entorno (marca los secretos como *sensitive*).
3. `NEXT_PUBLIC_APP_URL` = tu dominio final.
4. Deploy. `prebuild` genera los iconos PWA automáticamente.
5. Registra la URL del webhook en Mercado Pago **con el dominio de producción**.

Notas:

- Las rutas de API usan runtime Node (necesitan `node:crypto` para firmas y hashes).
- Las cabeceras de seguridad y la CSP se definen en `next.config.mjs`.
- El leaderboard se sirve con `s-maxage=15`, suficiente para aguantar un pico viral sin sentirse estático.

---

## Arquitectura

```
app/
  page.tsx                     landing
  scan/                        experiencia de escaneo
  result/[id]/                 resultado compartible (+ opengraph-image)
  challenge/[id]/              pantalla de reto
  leaderboard/                 ranking global
  legal/                       privacidad y disclaimer
  reroll/return|mock/          post-checkout (real / simulado)
  api/
    scan/                      POST genera aura · GET lee una
    leaderboard/               ranking
    session/                   sesión anónima + créditos · nickname
    payments/                  checkout, estado, mock-approve (solo dev)
    mercado-pago/webhook/      notificaciones verificadas

components/
  aura/       AuraScanner, FaceOverlay, ScanProgress, AuraReveal,
              LegendaryAuraReveal, AuraParticles, AuraScore, AuraScoreBoard,
              AuraTierBadge, AuraShareCard, AuraShockwave, AuraVersus,
              ChallengeScreen, ResultScreen
  camera/     CameraView
  payments/   RerollButton, PaymentStatus, MockCheckout
  leaderboard/Leaderboard, NicknameEditor
  landing/    LandingScreen
  providers/  SoundProvider, AchievementProvider, ServiceWorkerRegistrar
  ui/         AmbientBackground, primitives

lib/
  aura/       aura-config, aura-engine, aura-tiers, aura-easter-eggs,
              aura-theme, scan-service
  vision/     face-detection (MediaPipe + fallback heurístico)
  audio/      sound-engine (síntesis WebAudio)
  share/      share-card (canvas 1080×1920)
  supabase/   client, server, repository, memory-store, types
  mercado-pago/ client, webhook
  security/   session, rate-limit
  api/        http, schemas
  utils/      env, cn, format, nickname
  analytics/  eventos sin datos personales

hooks/        useCamera, useFaceDetection, useScanSequence
content/      aura-copy.ts (todo el texto)
supabase/migrations/
tests/
```

### Estados de la experiencia

```
landing → permiso de cámara → detección → lock → análisis (5.2 s)
        → blackout → reveal (o takeover legendario) → compartir / retar / reroll
```

### Decisiones que vale la pena conocer

- **Sin Three.js, sin GSAP, sin tsParticles.** Las partículas, el HUD y los efectos son Canvas 2D y CSS transform/opacity. En un teléfono de gama media eso es la diferencia entre 60fps y una presentación de diapositivas.
- **Sonido sintetizado, no archivos.** `lib/audio/sound-engine.ts` genera cada efecto con osciladores y ruido filtrado: 0 KB de descarga y el zumbido del escáner puede seguir el progreso real en lugar de ser un clip de duración fija.
- **La petición del resultado se dispara al inicio de la animación**, no al final. Cuando la barra se despega del 99%, el número ya está en memoria: el reveal nunca espera a la red, y una respuesta rápida tampoco acorta el suspenso.
- **`LegendaryAuraReveal` se carga bajo demanda.** Quien saca 240 no paga su peso.
- **Iconos generados por código** (`scripts/generate-icons.mjs`, PNG escrito a mano con zlib): el repo no carga binarios.
- **Service worker mínimo** (`public/sw.js`): hace la app instalable y da fallback offline del shell, pero **nunca cachea `/api/`** — puntuaciones, créditos y ranking siempre vienen del servidor.

#### Nota sobre `next/og` y rutas con espacios

Las tarjetas sociales dinámicas usan `next/og`. Ese paquete **no puede inicializarse cuando la ruta del proyecto contiene un espacio** (limitación conocida de `@vercel/og`, típica en checkouts locales de Windows como `.../Aura Detector/`).

Por eso las rutas de imagen son `force-dynamic` y están envueltas en `try/catch`: si `next/og` no arranca, sirven `public/og-fallback.png` en lugar de romper el build o devolver un 500. En Vercel (ruta sin espacios) se generan normalmente. Si quieres las tarjetas dinámicas también en local, clona el repo en una carpeta sin espacios.

---

## Motor de aura

`lib/aura/aura-engine.ts`. Reglas:

1. **El rostro no influye en el resultado.** El detector existe únicamente para el espectáculo. Ningún atributo de la persona —género, edad, tono de piel, apariencia, discapacidad— toca la puntuación. No hay ruta de código que lo permita.
2. La puntuación se genera **en el servidor**, a partir de una distribución ponderada y `crypto.getRandomValues`.
3. Todo es configurable desde `lib/aura/aura-config.ts`.

Distribución por defecto:

| Banda | Rango | Peso | Rareza |
| --- | --- | ---: | --- |
| cursed | −5000 … −1000 | 0.05 % | mítico |
| negative | −999 … −1 | 2.5 % | poco común |
| npc | 0 … 99 | 20 % | común |
| civil | 100 … 299 | 34 % | común |
| protagonist | 300 … 499 | 22 % | común |
| main_character | 500 … 749 | 13 % | poco común |
| legend | 750 … 899 | 6 % | raro |
| absurd | 900 … 999 | 2 % | muy raro |
| god | 1000 … 9999 | 0.45 % | legendario |

Dentro de cada banda la curva (`front`, `back`, `center`, `uniform`) decide dónde se concentran los valores: por eso un 1000 es mucho más probable que un 9999 aunque ambos vivan en la misma banda.

Además, un **3.5 %** de las tiradas devuelve un easter egg exacto (`0`, `69`, `404`, `420`, `666`, `777`, `911`, `999`, `1000`, `1337`, `9999`), cada uno con su propio texto y tratamiento visual.

Funciones públicas: `generateAuraScore()`, `determineAuraTier()`, `determineAuraRarity()`, `findEasterEgg()`, `getAuraMessage()`, `generateAuraResult()`.

---

## Seguridad

| Riesgo | Mitigación |
| --- | --- |
| Manipular el resultado | La puntuación se genera en el servidor. El cliente solo pide, nunca propone. |
| Manipular el precio | Precio y moneda salen de config del servidor. El body de la petición no puede alterarlos. |
| Webhook falsificado | HMAC-SHA256 verificado en tiempo constante. En producción, sin secreto → 401. |
| Webhook duplicado | `payments.provider_payment_id` único, `reroll_credits.payment_id` único, y guarda de estado terminal. |
| Refresh tras pagar | El estado se resuelve consultando a Mercado Pago, no leyendo la URL de retorno. |
| Gastar un crédito dos veces | `consume_reroll_credit()`: un solo `UPDATE` con `FOR UPDATE SKIP LOCKED`. |
| Spam de escaneos | Rate limit por sesión (10/h) y por IP hasheada (60/h), configurable. |
| Enumerar pagos ajenos | Los pagos solo se leen desde la sesión propietaria; si no, 404 (mismo error que "no existe"). |
| XSS vía nickname | Zod + allowlist de caracteres + tope de longitud, en servidor. |
| Fugas por logs | Se registra el código de error, nunca el cuerpo de la petición ni los tokens. |
| Acceso directo a datos | RLS activo sin políticas para `anon`; solo la vista `leaderboard` es pública. |

Cabeceras aplicadas a todas las rutas: `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy: camera=(self)`.

---

## Privacidad

- La cámara se procesa **exclusivamente en el navegador**. No se sube video, ni fotogramas, ni fotografías.
- No hay reconocimiento de identidad ni almacenamiento biométrico. La detección solo responde "hay una cara más o menos centrada", y esa señal no llega al motor de aura.
- La imagen para compartir se dibuja en un canvas local a partir del número; **jamás incluye la cámara**.
- Identidad anónima: un identificador aleatorio en una cookie `httpOnly`. Sin registro, sin correo.
- Para limitar abusos se guarda un conteo asociado a un **hash irreversible y salteado** de la IP. La IP no se almacena.
- El stream se libera (`track.stop()`) en cuanto termina el escaneo: la luz de la cámara se apaga sola.

Texto completo para el usuario final: [`/legal`](app/legal/page.tsx).

---

## Personalización

| Quiero cambiar… | Archivo |
| --- | --- |
| Probabilidades, precio, duración, límites | `lib/aura/aura-config.ts` |
| Tiers, colores, emojis, intensidad | `lib/aura/aura-tiers.ts` |
| Easter eggs | `lib/aura/aura-easter-eggs.ts` |
| Todos los textos y frases | `content/aura-copy.ts` |
| Logros | `lib/achievements.ts` |
| Paleta base y efectos | `app/globals.css` + `tailwind.config.ts` |
| Sonidos | `lib/audio/sound-engine.ts` |
| Tarjeta para compartir | `lib/share/share-card.ts` |
| Icono de la app | `scripts/generate-icons.mjs` |

### Battle mode (preparado, no activado)

La arquitectura ya soporta comparar dos resultados: `aura_scans.challenge_scan_id`, el tipo `ChallengeSummary` y el componente `ChallengeVerdict` en `AuraReveal`. Un modo AURA BATTLE 1v1 en tiempo real es, sobre esa base, una tabla `battles` más un canal de Supabase Realtime.

---

## Licencia

Uso privado. Ninguna IP de terceros, personajes o marcas están incluidos en el proyecto.

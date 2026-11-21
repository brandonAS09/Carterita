# Carterita

Aplicación móvil de finanzas personales que calcula cuánto puedes gastar hoy sin salirte de tu presupuesto.

Proyecto de la materia de Aplicaciones Móviles, UABC, 7.º semestre.

## Funciones

- **Presupuesto inteligente:** reparte lo que queda del ciclo (diario, semanal o mensual) entre los días restantes y renueva el ciclo solo.
- **Tres formas de registrar un gasto:** a mano, dictándolo ("gasté 85 en tacos") o con la foto del ticket.
- **Categorías que aprenden:** si corriges la categoría de un concepto, la próxima vez la sugiere sola.
- **Historial y reportes:** edición y borrado de gastos, gasto por categoría y por día, y comparación con el período anterior.
- **Metas de ahorro:** abonos y excedentes del día anterior, con celebración al completarlas.
- **Grupos:** ahorra en pareja, en familia o con roomies. Se unen con un código de 6 caracteres, comparten metas en las que se ve el aporte de cada persona y pueden compartir gastos. El presupuesto personal sigue siendo privado.
- **Modo claro y oscuro**, accesibilidad (texto grande, lector de pantalla) y pesos o dólares.

## Arquitectura

```
App móvil (Expo + React Native)  ──HTTPS/JSON──▶  API REST (Node.js + Express)  ──Prisma──▶  PostgreSQL
        Frontend/                                         Backend/                           (Neon)
                                                    desplegada en Render
```

| Capa | Tecnologías |
|---|---|
| App | Expo SDK 58, React Native 0.88, TypeScript, React Navigation, expo-secure-store, NetInfo, react-native-svg |
| API | Node.js 24, Express 5, TypeScript, zod, JWT, bcrypt |
| Datos | PostgreSQL 18 en Neon. Esquema y migraciones con Prisma 7 |
| Lectura de tickets y voz | ML Kit y reconocimiento de voz de Android en el teléfono. Desde Expo Go se hacen en el servidor con OCR.space y Whisper (Groq) |
| Pruebas | Jest en la app; Vitest y supertest en la API |

Decisiones principales:

- La base de datos solo se accede desde la API, con Prisma. Las versiones del esquema viven en `Backend/prisma/migrations/`.
- Las reglas que modifican datos (renovar el ciclo, aportar a una meta, permisos de grupo) se validan en el servidor.
- La app avisa cuando no hay conexión, conserva lo escrito si un guardado falla y no duplica nada al reintentar (cada guardado lleva un identificador).
- Cada usuario solo puede leer y modificar sus propios datos; un recurso ajeno responde `404`.

## Estructura

```
Backend/
  prisma/            schema.prisma, migraciones y datos iniciales
  src/routes/        auth, presupuesto, gastos, metas, grupos, lectura (OCR y voz)
  src/domain/        cálculos puros con pruebas (presupuesto, metas, fechas)
  src/__tests__/     pruebas de punta a punta de la API
Frontend/
  screens/           una pantalla por archivo
  src/api/           cliente HTTP (sesión, tiempos de espera, errores de red)
  src/services/      acceso a la API por recurso
  src/components/    componentes de interfaz y gráficas
  src/utils/         intérpretes de voz y tickets, reportes, fechas
  modules/receipt-ocr/  módulo nativo de OCR (ML Kit / Apple Vision)
```

## Cómo ejecutarlo

### API

Requisitos: Node.js 22 o superior y una base PostgreSQL (por ejemplo, una rama de Neon).

```bash
cd Backend
npm install
cp .env.example .env      # llenar DATABASE_URL, DIRECT_URL y JWT_SECRET
npx prisma migrate deploy
npm run db:seed           # categorías iniciales
npm run dev               # http://localhost:3000/health
npm test
```

Las llaves `OCR_SPACE_API_KEY` y `GROQ_API_KEY` son opcionales; solo se usan para leer tickets y voz desde Expo Go.

### App

```bash
cd Frontend
npm install
npx expo start --go       # abrir en Expo Go (Android o iPhone) en la misma red Wi-Fi
npm test
```

Por defecto la app usa la API publicada. Para usar una API local:
`EXPO_PUBLIC_API_URL=http://<IP-de-tu-PC>:3000 npx expo start --go`.

Para el build de desarrollo de Android, con lectura de tickets y voz en el teléfono: `npx expo run:android`.

## Bitácora y decisiones

- [BITACORA_IA.md](BITACORA_IA.md): cómo se usó la IA en cada sprint, qué se rechazó y qué errores se detectaron.
- [DECISIONES.md](DECISIONES.md): diario de decisiones de diseño y producto, con alternativas y motivos.

## API publicada

`https://carterita-api-r4u1.onrender.com` (plan gratuito: si estuvo inactiva, la primera petición tarda cerca de un minuto en despertar el servidor).

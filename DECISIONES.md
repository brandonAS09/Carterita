# Diario de decisiones

Decisiones de diseño y de producto de Carterita, en el orden en que se tomaron. Cada sprint empezó con un documento de especificación que proponía las decisiones con su recomendación. Yo las aprobaba, cambiaba o rechazaba antes de programar.

Formato: **qué se decidió**, qué alternativas había y **por qué**.

---

## Antes del Sprint 1 (agosto a octubre)

| Decisión | Por qué |
|---|---|
| App de finanzas personales centrada en **cuánto puedo gastar hoy**, no en un registro contable. | El problema real es llegar al fin del ciclo con dinero; un límite diario se entiende mejor que una tabla de gastos. |
| Expo + React Native + TypeScript. | Es lo que vimos en la materia y permite Android e iPhone con el mismo código. |
| La carpeta `docs/` (especificaciones y guías) no se sube al repositorio. | Son documentos de trabajo; en el repo queda el código, el README, esta bitácora y este diario. |

## Sprint 1 y 1.1 (2 y 3 de noviembre): cuenta, presupuesto y gasto manual

| Decisión | Alternativas | Por qué |
|---|---|---|
| Guardar las fechas como día **local** del usuario (`YYYY-MM-DD`). | Usar `toISOString()` (UTC). | En Tijuana (UTC-8), los gastos de la tarde caían en el día siguiente. |
| Contraseñas con hash y sal, nunca en texto plano. | Guardarlas tal cual (así estaban al inicio). | Seguridad básica; se migraron las existentes. |
| Solo MXN y USD, con tipo de cambio capturado por el usuario. | Incluir EUR; usar una API de tipos de cambio. | La app era 100 % local y no podía consultar tasas. EUR no aportaba. |
| Íconos de lucide en lugar de emojis. | Emojis. | Se ven distinto en cada teléfono y no son accesibles. |

## Sprint 2 y 3 (3 de noviembre): presupuesto inteligente, voz y metas

| Decisión | Alternativas | Por qué |
|---|---|---|
| **D1** Un monto dictado en otra moneda se convierte con el tipo de cambio guardado. | Rechazarlo. | Es común decir "gasté 10 dólares". |
| **D2** Voz sin internet cuando el teléfono lo soporta; si no, el reconocedor del sistema, con un aviso. | Solo en línea. | La app era offline. |
| **D3** Probar en el emulador de Android con un build de desarrollo. | iPhone. | Firmar para iPhone requiere Mac o cuenta de pago. |
| **D4** Permitir abonos manuales a las metas, además del excedente del día. | Solo excedentes. | Con ciclo diario no habría forma de avanzar una meta. |
| **D5** El excedente del último día del ciclo no se puede mover. | Moverlo al siguiente ciclo. | Simplifica el cálculo; quedó como limitación conocida. |
| **D6** Pestañas "Inicio" y "Metas". | Otros nombres. | Cortos y claros. |
| Descartar un primer intento del Sprint 2 (metas, voz y escáner juntos). | Corregirlo. | La calidad era baja; fue más rápido rehacerlo por partes. |

## Sprint 4 (4 de noviembre): escáner de tickets

| Decisión | Alternativas | Por qué |
|---|---|---|
| **D7** OCR con un módulo nativo propio de Google ML Kit. | `expo-text-extractor` o un servicio en la nube. | Necesitaba la **posición** de cada línea para emparejar "TOTAL" con su monto, y funcionar sin internet. |
| **D8** Cámara del sistema con recorte (`expo-image-picker`). | Cámara propia con guía. | Menos código y con galería incluida. |
| **D9** Usar la fecha del ticket si es de un día anterior dentro del ciclo. | Siempre hoy. | El usuario a veces registra tickets de ayer. |
| **D10** Si no hay un total confiable, no rellenar el monto; mostrar los montos detectados como sugerencias. | Adivinar. | Un monto equivocado prellenado es peor que pedirlo. |

## Sprint 5 (4 de noviembre): rediseño

| Decisión | Por qué |
|---|---|
| **D12** Mantener la cámara del sistema aunque la guía de diseño pedía cámara a pantalla completa. | Otra librería nativa por un detalle visual no valía la pena. |
| **D13** Mantener "Gastado hoy $X de $Y" en Inicio. | Sin eso el usuario no ve su límite. |
| **D14** Historial de solo lectura (editar llegó en el Sprint 6). | Editar afecta el recálculo y necesitaba su propio sprint. |
| **D16** Crear un ícono propio. | La app usaba el ícono de plantilla de Expo. |
| **D19** Trabajar el rediseño en una rama y unirla al terminar. | `master` siempre presentable. |
| Mover los mosaicos de Presupuesto, Gastado y Excedente más abajo, sobre la línea morada. | Corrección mía al revisar el diseño en el emulador. |

## Sprint 6 (5 a 9 de noviembre): editar, categorías que aprenden y reportes

| Decisión | Alternativas | Por qué |
|---|---|---|
| **D21** Calendario propio en JavaScript. | Librería nativa de fechas. | No obligaba a recompilar. |
| **D22** Al editar un gasto cuyo excedente ya se movió a una meta, el aporte se conserva. | Ajustar la meta. | Modificar metas por una corrección sorprendería al usuario. |
| **D23** Las categorías aprendidas usan coincidencia exacta del concepto normalizado. | Buscar parecidos. | Es predecible; los parecidos dan sugerencias difíciles de explicar. |
| **D24** Con ciclo diario, los reportes muestran "Últimos 7 días" y "Últimos 30 días". | Períodos de ciclo. | Un ciclo de un día no dice nada. |
| **D25** Paleta propia para las gráficas, validada para daltonismo en modo claro y oscuro. | Reusar los colores de éxito y error. | Que una categoría sea roja sugiere que "va mal". |

## Después de la presentación de avance (10 de noviembre)

El profesor pidió tres cambios: **base de datos desplegada con validaciones de red**, **Prisma para todo** (datos y versiones del esquema) y **grupos para ahorrar en conjunto**. También mencionó que la voz y el escáner deberían funcionar en iPhone.

## Sprint 7 (11 a 20 de noviembre): Carterita en línea

| Decisión | Alternativas | Por qué |
|---|---|---|
| **D26** Unir el Sprint 6 antes de empezar. | Seguir con ramas encimadas. | Partir de una base limpia. |
| **D27** Backend en Node.js + Express + TypeScript. | Otros lenguajes o frameworks. | Prisma es de Node, y así reutilizamos las funciones con pruebas sin reescribirlas. |
| **D28** Carpeta `Backend/` en el mismo repositorio. | Repositorio aparte. | Una sola entrega y una sola historia de commits. |
| **D29** Dinero como `Decimal(12,2)`. | `REAL`/`float`, como en SQLite. | Evita errores de centavos. |
| **D30** El teléfono manda su fecha local; cada gasto guarda el instante y el día local. | Calcular "hoy" en el servidor. | El servidor está en UTC y el límite depende del día del usuario. |
| **D31** PostgreSQL en Neon y API en Render, ambos gratis. | Supabase, Railway, plan de pago. | Sin costo y se integran con Prisma y GitHub. A cambio, Render se duerme tras 15 minutos sin uso. |
| **D32** JWT de 30 días en SecureStore, sin tokens de renovación. | Tokens de renovación. | Suficiente para el alcance y mucho más simple. |
| **D33** La app requiere internet, con avisos claros, sin perder lo escrito. | Base local con sincronización. | Sincronizar es lo más difícil de este tipo de apps y no cabía en el plazo. Queda pendiente. |
| **D34** Cada guardado lleva un `clienteId`; si llega dos veces, no se duplica. | Confiar en deshabilitar el botón. | Cubre el caso de "se guardó pero la respuesta se perdió". |
| **D35** No migrar los datos locales; crear una cuenta de demostración. | Hacer un importador. | Eran datos de prueba y el importador costaba un día. |
| **D44** iPhone con **Expo Go**, leyendo tickets y transcribiendo voz en el servidor. | Pagar la cuenta de Apple Developer (99 USD al año); pedir prestada una Mac. | No tengo Mac ni cuenta de pago. Expo Go incluye la cámara y el micrófono, pero no ML Kit ni el reconocimiento de voz. |
| **D45** OCR.space para tickets y Whisper de Groq para voz. | Google Cloud (pide tarjeta), Tesseract (poco preciso y pesado). | Planes gratuitos sin tarjeta y buena calidad. Las llaves solo viven en el servidor. |
| **D42** Mandar a reserva lo planeado antes (recordatorios, huella, exportar a CSV, voz avanzada). | Hacerlo todo. | Las peticiones del profesor tenían prioridad. |

## Sprint 8 (18 a 20 de noviembre): grupos

| Decisión | Alternativas | Por qué |
|---|---|---|
| **D36** "Grupos" en una pestaña propia. | Dentro de Metas. | Cubre pareja, familia y roomies, y se descubre más fácil. |
| **D37** De 2 a 6 miembros, código de 6 caracteres válido 48 h, roles Admin y Miembro. | Enlaces de invitación. | Un código se dicta o comparte fácil. Solo vence la invitación, no el grupo. |
| **D38** Metas del grupo donde cualquiera abona y se ve cuánto aportó cada persona. | Una meta sin detalle. | Es el ejemplo del profesor (viaje en pareja); ver quién aportó cuánto da confianza. |
| **D39** Gastos que cada quien decide compartir, con el total y lo que pagó cada miembro, sin calcular deudas. | Un presupuesto común completo. | Un presupuesto común cambiaba el corazón de la app. Calcular deudas queda pendiente. |
| **D40** El grupo solo ve lo que se comparte. | Ver todo. | Privacidad del presupuesto personal. |
| **D41** Se actualiza al abrir la pantalla y al deslizar hacia abajo. | Tiempo real. | El tiempo real requiere WebSockets y un servidor siempre encendido. |
| **D43** Quien sale elige si deja o retira sus aportes; si el admin quita a alguien, sus aportes se quedan. | Siempre dejarlos. | Pregunta mía: ¿qué pasa si alguien se va antes de tiempo? En la vida real se puede llevar su parte. |

## Ajustes al probar (20 y 21 de noviembre)

| Decisión | Por qué |
|---|---|
| Las fotos y el audio se suben con `XMLHttpRequest`. | En Expo Go (SDK 58), `fetch` no acepta archivos con `uri` ("Unsupported FormDataPart implementation"). |
| Si el renglón TOTAL del ticket se lee mal, el total sale de SUBTOTAL + IVA, con confianza media. | En la prueba, OCR.space leyó "$89.50" como ".50". |
| El chip para no compartir dice "Solo yo". | "Solo para mí" se cortaba en Android dentro de una fila con scroll horizontal. |

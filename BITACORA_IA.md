# Bitácora de uso de IA

## Herramienta y forma de trabajo

- **Primera herramienta (descartada):** al principio del proyecto trabajé con AGY, pero me dejó el código hecho un cochinero: desordenado y difícil de mantener. Por eso cambié de herramienta.
- **Herramienta actual:** Claude Code (asistente de programación de Anthropic) en la terminal, con acceso al proyecto, al emulador de Android por `adb` y a Git. Todo lo que sigue en esta bitácora se hizo con Claude Code.
- **Rol que le di:** programador senior y Scrum Master. Yo hago de dueño del producto: decido qué se construye y valido el resultado.
- **Ciclo de cada sprint:**
  1. Le pido una función en mis palabras.
  2. La IA escribe una especificación en `docs/` con criterios de aceptación y **decisiones marcadas**, cada una con su recomendación.
  3. Leo las decisiones y las apruebo, las cambio o las rechazo. Están en [DECISIONES.md](DECISIONES.md).
  4. La IA programa, escribe pruebas automáticas y prueba en el emulador.
  5. Yo pruebo en el emulador o en mi celular y doy el visto bueno.
  6. Commit por función y unión a `master`.
- **Reglas que le puse:** responder en español, nada de emojis en la interfaz (solo íconos), no subir `docs/`, no hacer commits ni subir cambios sin que yo valide, y no mandar mi correo a servicios externos.

## Registro por sprint

### Agosto a octubre: arranque

- Pantallas de login y menú, primero con datos falsos y luego conectadas.
- Saqué `docs/` del repositorio para que solo quede el código.

### Sprint 1 y 1.1 (2 y 3 de noviembre)

- **Qué pedí:** cuenta, presupuesto inicial y registro manual de gastos.
- **Qué detectó la IA al revisar lo que ya había:**
  - Las fechas se guardaban en UTC, así que los gastos de la tarde caían en el día siguiente en Tijuana.
  - Las contraseñas estaban en texto plano.
  - Ambas cosas se corrigieron en el Sprint 1.1, junto con migraciones para no perder datos.
- **Qué cambié yo:** quité EUR (solo MXN y USD) y pedí íconos en lugar de emojis.

### Sprint 2 y 3 (3 de noviembre)

- **Qué pedí:** presupuesto inteligente, registro por voz y metas de ahorro.
- **Qué rechacé:** un primer intento que mezclaba metas, voz y escáner. La calidad era baja y lo descarté completo. Se rehízo por partes, una función por commit.
- **Cómo verifiqué:** probé la voz en el emulador antes de aprobarla. El commit de la pantalla de voz quedó marcado como "pendiente de validar" hasta que la probé.

### Sprint 4 (4 de noviembre): escáner de tickets

- **Qué propuso la IA:** un módulo nativo propio con Google ML Kit, porque las librerías listas no daban la posición de cada línea del ticket.
- **Error de la IA:** el primer commit incluyó más de 100 archivos generados al compilar (`modules/receipt-ocr/android/build`).
  - **Cómo se detectó:** al revisar el commit antes de subirlo.
  - **Solución:** se corrigió ese commit y se agregó la carpeta a `.gitignore`.
- **Resultado real:** probé con 3 tickets usando la cámara del emulador. Uno salió bien pero sin categoría, otro cerca pero mal y otro muy lejos. Lo atribuí a la cámara del emulador y a la luz.

### Sprint 5 (4 de noviembre): rediseño

- **Qué hice yo:** escribí la guía de diseño (`UX_UI_Guide_v2`) y la IA la convirtió en un sprint.
- **Qué detectó la IA en mi guía:** contradicciones que había que resolver (decisiones D12 a D18). Por ejemplo, pedía una cámara a pantalla completa cuando ya habíamos elegido la del sistema, y mencionaba un logo que no existía.
- **Qué cambié yo:** al revisar el diseño en el emulador pedí bajar los mosaicos de Presupuesto, Gastado y Excedente para que quedaran sobre la línea morada.
- **Errores que encontraron las pruebas:**
  - Una prueba automática de contraste reprobó el chip de la cabecera en modo claro y se corrigió el color.
  - Con texto al 200 %, el botón "Escanear" se partía en dos líneas.

### Sprint 6 (5 a 9 de noviembre): editar, categorías que aprenden y reportes

- **Errores que salieron al revisar en el emulador:**
  - El calendario decía "Noviembre De 2026".
  - Había etiquetas de accesibilidad duplicadas.
  - Con texto grande, los nombres de los reportes se cortaban y las fechas del eje se encimaban.
  - Todo se corrigió antes de aprobarlo.
- **Cómo se verificaron los datos:** con pruebas de integración contra SQLite real. Para comprobar que esas pruebas sí detectan errores, se introdujo un error a propósito y las pruebas lo atraparon.
- **Error de la IA:** me dijo que había dejado el emulador encendido para que yo probara, pero se había cerrado. Lo corrigió ella misma en el siguiente mensaje.

### Presentación de avance (10 de noviembre)

- Antes le había preguntado a la IA si teníamos una base de datos desplegada. Me explicó que todo era local (SQLite en el teléfono), y como el profesor no lo exigía, decidí dejarlo así. En la presentación **el profesor pidió lo contrario**: base de datos desplegada, Prisma para todo y grupos. La app tuvo que pasar de 100 % local a cliente-servidor.
- **Aclaración que hizo la IA:** la app **no usaba Prisma**. Las versiones de la base se manejaban con SQLite y `PRAGMA user_version`. Además, Prisma no corre dentro del teléfono, así que hacía falta un servidor.
- Le pregunté a la IA por qué la carpeta `Backend` estaba vacía. Revisó el repositorio y el historial: **esa carpeta no existía**, y Git no guarda carpetas vacías. Ahora `Backend/` sí tiene el servidor.

### Sprint 7 y 8 (11 a 21 de noviembre): en línea, Prisma y grupos

- **Qué pedí:** atender las tres peticiones del profesor y que la voz y el escáner funcionen en iPhone.
- **Qué cuestioné:** pregunté si el código de 48 horas de los grupos hacía que se "desincronizaran" y qué pasaba si alguien salía antes de tiempo. Lo primero era una confusión: solo vence la invitación, no el grupo. Lo segundo generó una decisión nueva (D43): quien sale elige si deja o retira sus aportes.
- **Qué rechacé:** pagar la cuenta de Apple Developer. Como solo tengo un iPhone sin Mac, el plan cambió a Expo Go con la lectura de tickets y la voz hechas en el servidor (D44).
- **Lo que hice yo:** crear las cuentas de Neon, Render, OCR.space y Groq y poner las llaves en `Backend/.env` y en Render. Las llaves nunca se escribieron en el chat.
- **Errores y problemas:**
  1. **Calendario:** el plan decía que el Sprint 7 terminaba el 17. El 20 solo estaba la base del servidor. La IA lo dijo abiertamente y propuso un orden de prioridades, que acepté: primero lo de la base de datos, luego grupos y al final iPhone.
  2. **Subida de fotos en Expo Go:** la primera versión mandaba los archivos con `fetch` y en Expo Go fallaba con "Sin conexión", aunque sí había internet. La IA agregó un registro del error real ("Unsupported FormDataPart implementation"). Así encontró que en Expo SDK 58 `fetch` no acepta archivos con `uri`. Se cambió a `XMLHttpRequest`. **Se detectó probando en Expo Go**, no con las pruebas automáticas.
  3. **Ticket mal leído:** OCR.space leyó "$89.50" como ".50" en el renglón TOTAL. Se agregó un respaldo con SUBTOTAL + IVA y una prueba para ese caso.
  4. **Expresión regular dañada:** un comando de la terminal escribió caracteres de control en lugar de `\b` dentro de una expresión regular. **Una prueba automática lo detectó** (esperaba 89.5 y obtuvo 80) y se corrigió.
  5. **Llaves en `.env.example`:** durante la configuración, las llaves de OCR.space y Groq quedaron un momento en la plantilla `.env.example`, que sí se sube a Git. Se detectó, se quitaron y se revisó todo el historial de Git: nunca se subieron, así que no hubo que generar llaves nuevas.
  6. **Chip cortado:** "Solo para mí" se partía en dos líneas en Android; se cambió a "Solo yo".
  7. **Casos límite de la rúbrica (22 de noviembre):** le pregunté a la IA si habían pasado todos.
     - **Contestó con honestidad:** varios solo estaban cubiertos con pruebas automáticas, no probados a mano.
     - **"Tocar guardar dos veces" no estaba resuelto del todo.** Si los dos envíos llegaban al mismo tiempo, el gasto se guardaba una vez, pero el segundo respondía "error del servidor". Se corrigió y se agregó una prueba que manda los dos envíos simultáneos.
     - **"12abc" se guardaba como 12** porque se usaba `parseFloat`. Se cambió por una validación estricta.
     - **En el APK**, el campo de monto aceptaba 200 caracteres. Se limitó a 14.
     - Después se probaron en el APK: girar el celular, negar el permiso de cámara y escribir 200 letras.
- **Cómo verifiqué:**
  - 56 pruebas del servidor contra la base de desarrollo, incluidas pruebas de acceso a datos ajenos (2 de ellas usan OCR.space y Groq reales).
  - 283 pruebas de la app.
  - Recorrido completo en el emulador con el build de desarrollo y con Expo Go: registro, gastos, modo avión, grupo con dos cuentas y escáner.
  - Prueba en mi celular, donde todo funcionó.
- **Bloqueo de seguridad de la herramienta:** Claude Code bloqueó un script que iba a escribir datos de demostración directamente en la base de producción y pidió mi autorización explícita.

## Lo que aprendí sobre trabajar con IA

- **La herramienta importa.** Con AGY el código quedó desordenado y tuve que cambiar. Con Claude Code, pedir una especificación antes de programar y un commit por función me permitió revisar cada paso.
- **Pedir que proponga decisiones antes de programar** me dejó entender y controlar el proyecto. Las decisiones donde no estuve de acuerdo (diseño, iPhone, salida de grupos) cambiaron el resultado.
- **No confiar en "ya funciona" sin probar en el dispositivo.** Dos de los errores más importantes (subir fotos en Expo Go y el ticket mal leído) solo aparecieron al usar la app, no en las pruebas automáticas.
- **Las pruebas automáticas sí atraparon errores que yo no habría visto**, como el contraste del chip y la expresión regular dañada.
- **La IA también se equivoca en cosas simples:** dijo que el emulador seguía encendido cuando se había cerrado, y su calendario se atrasó. Hay que pedirle que verifique antes de afirmar.
- **Los secretos se revisan siempre antes de cada commit.**

# Product Specification: Carterita

## 1. Definición del Problema
La gestión financiera personal suele requerir un alto esfuerzo de captura manual por parte de los usuarios. Esta fricción constante en el ingreso de datos provoca una alta tasa de abandono en las aplicaciones de finanzas convencionales. Además, los sistemas de presupuestos rígidos no se adaptan al flujo dinámico de ingresos y gastos del día a día, frustrando al usuario cuando no logra cumplir sus proyecciones con exactitud. Se necesita una herramienta que reduzca el tiempo de captura a segundos y adapte el presupuesto de manera inteligente y flexible.

## 2. Usuario Principal
**Perfil:** Jóvenes adultos, estudiantes universitarios o profesionales jóvenes que desean tomar el control de su dinero sin invertir más de unos minutos al día.
**Qué necesita:**
- Registrar sus gastos de forma inmediata "sobre la marcha" sin navegar por múltiples menús.
- Saber exactamente cuánto dinero pueden gastar *hoy* sin comprometer sus metas financieras de la semana o del mes.
- Sentir que ahorrar es gratificante (gamificación) en lugar de percibirlo como una restricción o un castigo.
- Privacidad y seguridad: Quieren saber que sus datos financieros no están en la nube ni conectados de manera riesgosa a sus cuentas bancarias.

## 3. Definición del MVP (Minimum Viable Product)
El MVP de "Carterita" será una aplicación móvil que permitirá al usuario crear una cuenta para proteger y personalizar su perfil, configurar un presupuesto y registrar gastos de tres formas (Motor Multimodal): registro manual, dictado por voz y escaneo de tickets. La aplicación recalculará el presupuesto diario disponible en base a los registros recientes e indicará visualmente si el usuario logró generar un excedente.

**Limitaciones/Fronteras del MVP:** Operación con persistencia local mediante SQLite para los gastos, pero con un sistema de Autenticación integrado para mantener sesiones seguras y personalizadas. Sin conexión a APIs de bancos reales.

## 4. Lista de Features Iniciales (Product Backlog)

| ID  | Título | Descripción de alto nivel |
| --- | --- | --- |
| **F00** | **Autenticación (Login/Registro)** | Sistema de creación de cuenta e inicio de sesión para proteger el acceso a las finanzas del usuario. |
| **F01** | **Onboarding y Configuración de Presupuesto** | Flujo inicial donde el usuario define su moneda local y su presupuesto base (diario, semanal o mensual). |
| **F02** | **Registro de Gasto Manual** | Formulario rápido para introducir monto, categoría sugerida y concepto de forma tradicional. |
| **F03** | **Registro de Gasto por Voz** | Integración del micrófono (TTS/STT) para transcribir la voz a texto, extraer el monto y sugerir la categoría automáticamente (Ej. "Gasté 50 pesos en comida"). |
| **F04** | **Registro de Gasto por Escáner (OCR)** | Integración de cámara usando Google ML Kit para tomar foto a un ticket, extrayendo el monto total y fecha automáticamente. |
| **F05** | **Dashboard y Resumen Principal** | Pantalla principal mostrando el saldo actual disponible del ciclo, los gastos recientes y estado del presupuesto. |
| **F06** | **Recálculo Inteligente de Presupuesto** | Algoritmo que ajusta el límite diario disponible dinámicamente si el usuario gastó menos o más en los días anteriores del ciclo. |
| **F07** | **Gestión de Metas de Ahorro (Gamificada)** | Sección para crear metas (Ej. "Viaje", "Laptop") donde los fondos excedentes diarios del presupuesto se pueden destinar como un logro para alcanzarlas. |
| **F08** | **Historial y Gestión de Datos** | Pantalla para ver el historial completo de transacciones (CRUD) e interfaz básica de ajuste de categorías. |

---
*Nota SDD: Este documento evolucionará como nuestra "Single Source of Truth" (Única Fuente de Verdad) conforme desarrollemos el proyecto.*

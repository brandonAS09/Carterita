# Guía de Estilo UX/UI - Carterita

Esta guía establece los principios de diseño, la paleta de colores, tipografía y componentes básicos para la aplicación **Carterita**, asegurando una experiencia de usuario consistente, accesible y atractiva.

## 1. Paleta de Colores

El diseño utiliza un tema oscuro (Dark Mode) por defecto, con tonos verdes que evocan conceptos de finanzas, dinero, crecimiento y seguridad.

| Uso / Elemento | Color | Hexadecimal |
| :--- | :---: | :--- |
| **Fondo (Background)** | ![#070708](https://via.placeholder.com/20/070708/070708) | `#070708` |
| **Terciario** (Tarjetas, contenedores) | ![#0B2A1A](https://via.placeholder.com/20/0B2A1A/0B2A1A) | `#0B2A1A` |
| **Primario** (Navbars, cabeceras) | ![#135C3A](https://via.placeholder.com/20/135C3A/135C3A) | `#135C3A` |
| **Secundario** (Botones, FAB, Accent) | ![#2FA36A](https://via.placeholder.com/20/2FA36A/2FA36A) | `#2FA36A` |
| **Texto** (Títulos y cuerpo) | ![#D8E6DF](https://via.placeholder.com/20/D8E6DF/D8E6DF) | `#D8E6DF` |
| **Error / Alerta** (Casos negativos, borrar) | ![#CF6679](https://via.placeholder.com/20/CF6679/CF6679) | `#CF6679` |

> [!TIP]
> **Accesibilidad:** El color de texto `#D8E6DF` ofrece un excelente contraste sobre el fondo oscuro `#070708` y el contenedor terciario `#0B2A1A`, garantizando una lectura cómoda y reduciendo la fatiga visual.

## 2. Tipografía (Recomendada)

Para complementar el estilo moderno de la aplicación, sugiero una tipografía *Sans-Serif* geométrica o humanista que ofrezca gran legibilidad en pantallas móviles.

*   **Fuente Principal Recomendada:** **Inter**, **Poppins** o **Roboto** (Nativa de Android).
*   **Jerarquía Visual:**
    *   **H1 (Títulos Principales / Balance):** 32sp, Bold o SemiBold.
    *   **H2 (Subtítulos / Secciones):** 20sp - 24sp, Medium. (Ej. "Últimas transacciones").
    *   **Body 1 (Texto General):** 16sp, Regular.
    *   **Body 2 (Texto Secundario):** 14sp, Regular. (Se sugiere aplicar un 70% de opacidad al color `#D8E6DF` para descripciones o fechas, para no competir con el texto principal).

> [!IMPORTANT]
> **Números Tabulares (Tabular Figures):** Para los saldos y montos de dinero, es vital activar la característica de "números tabulares" en fuentes como Inter o Roboto. Esto asegura que todos los números tengan el mismo ancho, evitando que la interfaz "brinque" cuando el monto cambia al registrar un gasto o recalcular el presupuesto.

## 3. Componentes UI

### Botones
Los elementos interactivos deben ser prominentes y fáciles de tocar (mínimo 48dp de alto).

*   **Botón Principal (Call to Action):**
    *   **Fondo:** `#2FA36A` (Secundario)
    *   **Texto:** Color oscuro (ej. `#070708`) o Blanco para un alto contraste.
    *   **Borde Redondeado:** 12dp o 16dp para un look moderno.
*   **Botón Secundario (Outlined):**
    *   **Fondo:** Transparente.
    *   **Borde:** 2dp sólido `#2FA36A`.
    *   **Texto:** `#2FA36A`.
*   **Botón Deshabilitado (Disabled):**
    *   **Fondo:** `#333333` (Gris oscuro).
    *   **Texto:** `#D8E6DF` al 50% de opacidad.
    *   **Uso:** Formularios de gasto, login o registro cuando los datos requeridos aún no están completos.

### Tarjetas (Cards)
Ideales para listar transacciones o mostrar cuentas.
*   **Fondo:** `#0B2A1A` (Terciario).
*   **Borde (Opcional):** Un borde muy sutil (1dp) en color `#135C3A` (Primario) puede ayudar a delimitar la tarjeta si se requiere más separación del fondo.
*   **Border Radius:** 16dp.

### Inputs (Campos de Texto)
*   **Fondo del Input:** `#0B2A1A` o Transparente.
*   **Línea o Borde Inactivo:** `#135C3A`.
*   **Línea o Borde Activo (Focus):** `#2FA36A`.
*   **Línea o Borde de Error:** `#CF6679`.

### Iconografía
Para mantener consistencia en la interfaz, especialmente en el selector de categorías y en las acciones del motor multimodal (micrófono, cámara), se recomienda el uso de una familia tipográfica de iconos uniforme.
*   **Recomendación:** **Material Symbols Rounded** o **Feather Icons**. Su estilo de trazos suaves y esquinas redondeadas hace un excelente match con el *border radius* de 12dp/16dp de nuestros botones y tarjetas.

## 4. Espaciado y Layout

Se recomienda utilizar un sistema basado en múltiplos de 8 (8dp, 16dp, 24dp, 32dp) para mantener el diseño consistente y armónico.

*   **Márgenes generales de la pantalla:** 16dp o 24dp.
*   **Espacio entre elementos de una lista:** 8dp o 12dp.
*   **Padding interior en botones:** 16dp horizontal, 12dp vertical.

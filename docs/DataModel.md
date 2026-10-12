# Technical Data Model & Architecture (SDD)

*Este documento definirá las entidades locales y relaciones en la base de datos (SQLite) previo a la implementación técnica. Es el contrato de datos del proyecto.*

## 1. Entidades Principales (Borrador Arquitectónico)

- **Usuario**
  - `id` (PK)
  - `email` (Text - Único)
  - `password_hash` (Text)
  - `nombre` (Text)

- **Transaccion (Gasto/Ingreso)**
  - `id` (PK)
  - `usuario_id` (FK -> Usuario.id)
  - `monto` (Decimal/Double)
  - `fecha` (DateTime)
  - `concepto` (Text)
  - `categoria_id` (FK -> Categoria.id)
  - `origen_registro` (Enum/Text: Manual, Voz, OCR)

- **Categoria**
  - `id` (PK)
  - `nombre` (Text)
  - `icono` (Text/ResID)
  - `es_default` (Boolean)

- **Presupuesto (Configuración del Ciclo)**
  - `id` (PK)
  - `usuario_id` (FK -> Usuario.id)
  - `monto_base` (Decimal/Double)
  - `tipo_ciclo` (Enum/Text: Diario, Semanal, Mensual)
  - `fecha_inicio` (Date)
  - `fecha_fin` (Date)
  - `moneda_simbolo` (Text)

- **MetaAhorro**
  - `id` (PK)
  - `nombre` (Text)
  - `monto_objetivo` (Decimal/Double)
  - `monto_acumulado` (Decimal/Double)
  - `fecha_limite` (Date - Opcional)

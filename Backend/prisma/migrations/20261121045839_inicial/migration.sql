-- CreateEnum
CREATE TYPE "TipoCiclo" AS ENUM ('Diario', 'Semanal', 'Mensual');

-- CreateEnum
CREATE TYPE "Moneda" AS ENUM ('MXN', 'USD');

-- CreateEnum
CREATE TYPE "Origen" AS ENUM ('Manual', 'Voz', 'OCR');

-- CreateEnum
CREATE TYPE "TipoAporte" AS ENUM ('Excedente', 'Abono', 'Retiro');

-- CreateEnum
CREATE TYPE "RolGrupo" AS ENUM ('Admin', 'Miembro');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "zonaHoraria" TEXT NOT NULL DEFAULT 'America/Tijuana',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Presupuesto" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "montoBase" DECIMAL(12,2) NOT NULL,
    "tipoCiclo" "TipoCiclo" NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'MXN',
    "fechaInicio" DATE NOT NULL,
    "fechaFin" DATE NOT NULL,
    "tipoCambioUsd" DECIMAL(10,4),

    CONSTRAINT "Presupuesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "icono" TEXT NOT NULL,
    "esDefault" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaccion" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "fechaLocal" DATE NOT NULL,
    "concepto" TEXT NOT NULL,
    "categoriaId" INTEGER,
    "origen" "Origen" NOT NULL DEFAULT 'Manual',
    "grupoId" INTEGER,
    "clienteId" TEXT NOT NULL,

    CONSTRAINT "Transaccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaAhorro" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER,
    "grupoId" INTEGER,
    "creadaPorId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "montoObjetivo" DECIMAL(12,2) NOT NULL,
    "montoAcumulado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "icono" TEXT,
    "fechaLimite" DATE,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetaAhorro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AporteMeta" (
    "id" SERIAL NOT NULL,
    "metaId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" "TipoAporte" NOT NULL,
    "fechaOrigen" DATE,
    "clienteId" TEXT NOT NULL,

    CONSTRAINT "AporteMeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreferenciaCategoria" (
    "usuarioId" INTEGER NOT NULL,
    "clave" TEXT NOT NULL,
    "categoriaId" INTEGER NOT NULL,
    "usos" INTEGER NOT NULL DEFAULT 1,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreferenciaCategoria_pkey" PRIMARY KEY ("usuarioId","clave")
);

-- CreateTable
CREATE TABLE "Grupo" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Grupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiembroGrupo" (
    "grupoId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "rol" "RolGrupo" NOT NULL DEFAULT 'Miembro',
    "unidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MiembroGrupo_pkey" PRIMARY KEY ("grupoId","usuarioId")
);

-- CreateTable
CREATE TABLE "InvitacionGrupo" (
    "grupoId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvitacionGrupo_pkey" PRIMARY KEY ("grupoId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Presupuesto_usuarioId_key" ON "Presupuesto"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_nombre_key" ON "Categoria"("nombre");

-- CreateIndex
CREATE INDEX "Transaccion_usuarioId_fechaLocal_idx" ON "Transaccion"("usuarioId", "fechaLocal");

-- CreateIndex
CREATE INDEX "Transaccion_grupoId_fechaLocal_idx" ON "Transaccion"("grupoId", "fechaLocal");

-- CreateIndex
CREATE UNIQUE INDEX "Transaccion_usuarioId_clienteId_key" ON "Transaccion"("usuarioId", "clienteId");

-- CreateIndex
CREATE INDEX "MetaAhorro_usuarioId_idx" ON "MetaAhorro"("usuarioId");

-- CreateIndex
CREATE INDEX "MetaAhorro_grupoId_idx" ON "MetaAhorro"("grupoId");

-- CreateIndex
CREATE INDEX "AporteMeta_metaId_idx" ON "AporteMeta"("metaId");

-- CreateIndex
CREATE UNIQUE INDEX "AporteMeta_usuarioId_clienteId_key" ON "AporteMeta"("usuarioId", "clienteId");

-- CreateIndex
CREATE INDEX "MiembroGrupo_usuarioId_idx" ON "MiembroGrupo"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "InvitacionGrupo_codigo_key" ON "InvitacionGrupo"("codigo");

-- AddForeignKey
ALTER TABLE "Presupuesto" ADD CONSTRAINT "Presupuesto_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaAhorro" ADD CONSTRAINT "MetaAhorro_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaAhorro" ADD CONSTRAINT "MetaAhorro_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaAhorro" ADD CONSTRAINT "MetaAhorro_creadaPorId_fkey" FOREIGN KEY ("creadaPorId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AporteMeta" ADD CONSTRAINT "AporteMeta_metaId_fkey" FOREIGN KEY ("metaId") REFERENCES "MetaAhorro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AporteMeta" ADD CONSTRAINT "AporteMeta_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferenciaCategoria" ADD CONSTRAINT "PreferenciaCategoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferenciaCategoria" ADD CONSTRAINT "PreferenciaCategoria_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiembroGrupo" ADD CONSTRAINT "MiembroGrupo_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiembroGrupo" ADD CONSTRAINT "MiembroGrupo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitacionGrupo" ADD CONSTRAINT "InvitacionGrupo_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reglas que Prisma no puede expresar en el esquema (Sprint 7)

-- El excedente de un día solo se puede mover una vez por usuario
CREATE UNIQUE INDEX "AporteMeta_excedente_por_dia_key"
  ON "AporteMeta" ("usuarioId", "fechaOrigen")
  WHERE "tipo" = 'Excedente';

-- Una meta pertenece a una persona o a un grupo, nunca a ambos ni a ninguno
ALTER TABLE "MetaAhorro"
  ADD CONSTRAINT "MetaAhorro_un_solo_dueno_check"
  CHECK (("usuarioId" IS NULL) <> ("grupoId" IS NULL));

-- Montos siempre positivos
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_monto_positivo_check" CHECK ("monto" > 0);
ALTER TABLE "AporteMeta" ADD CONSTRAINT "AporteMeta_monto_positivo_check" CHECK ("monto" > 0);
ALTER TABLE "MetaAhorro" ADD CONSTRAINT "MetaAhorro_acumulado_no_negativo_check" CHECK ("montoAcumulado" >= 0);

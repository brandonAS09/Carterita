import { prisma } from '../src/db.js';

// Las 8 categorías de siempre, con los mismos íconos de lucide que usa la app.
const CATEGORIAS = [
  { nombre: 'Comida', icono: 'utensils' },
  { nombre: 'Transporte', icono: 'car' },
  { nombre: 'Entretenimiento', icono: 'tv' },
  { nombre: 'Salud', icono: 'heart-pulse' },
  { nombre: 'Compras', icono: 'shopping-bag' },
  { nombre: 'Educación', icono: 'book-open' },
  { nombre: 'Servicios', icono: 'bolt' },
  { nombre: 'Otros', icono: 'circle-ellipsis' },
];

async function main() {
  for (const categoria of CATEGORIAS) {
    await prisma.categoria.upsert({ where: { nombre: categoria.nombre }, update: {}, create: categoria });
  }
  console.log(`Categorías listas: ${await prisma.categoria.count()}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

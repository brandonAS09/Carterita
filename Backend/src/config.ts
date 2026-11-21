// Los cálculos de fechas trabajan con días 'YYYY-MM-DD'; el servidor siempre en UTC evita sorpresas.
process.env.TZ = 'UTC';

import 'dotenv/config';
import { z } from 'zod';

// Si falta una variable, el servidor no arranca y dice cuál (nunca muestra su valor).
const schema = z.object({
  DATABASE_URL: z.string().startsWith('postgres'),
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().positive().default(3000),
  OCR_SPACE_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const campos = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
  throw new Error(`Variables de entorno inválidas o faltantes: ${campos}`);
}

export const config = {
  databaseUrl: parsed.data.DATABASE_URL,
  jwtSecret: parsed.data.JWT_SECRET,
  port: parsed.data.PORT,
  ocrSpaceApiKey: parsed.data.OCR_SPACE_API_KEY,
  groqApiKey: parsed.data.GROQ_API_KEY,
};

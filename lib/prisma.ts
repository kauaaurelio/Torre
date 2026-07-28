import { PrismaClient } from '@prisma/client';

// Singleton — em dev o Next recarrega módulos e criaria N clients, estourando
// conexões. Guardamos no globalThis. O worker roda em processo separado e tem
// a própria instância, apontando pro mesmo arquivo SQLite (ver .env).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: ['warn', 'error'] });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Config (freios globais + defaults) e Worker (heartbeat do processo) são
// singletons (id=1). As Sessões NÃO são mais singleton — o operador cria uma por
// número na tela de Conexão. Garante os singletons antes de ler.
export async function garanteSingletons() {
  await prisma.config.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  await prisma.worker.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

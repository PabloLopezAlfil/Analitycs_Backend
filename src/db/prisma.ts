import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client.js';

let client: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (!client) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL no está definida en el entorno');
    }
    const adapter = new PrismaMariaDb(connectionString);
    client = new PrismaClient({ adapter });
  }
  return client;
}

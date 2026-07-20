import type { PrismaClient, User } from '../../../../generated/prisma/client.js';
import type { UserInterface } from '../../domain/user.interface.js';
import type { UserRepository } from './user.repository.js';


function toUser(row: User): UserInterface {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.passwordHash,
    createdAt: row.created_at.toISOString(),
  };
}

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<UserInterface | null> {
    const row = await this.prisma.user.findUnique({ where: { email } });
    return row ? toUser(row) : null;
  }
}

import type { UserInterface } from '../../domain/user.interface.js';


export interface UserRepository {
  findByEmail(email: string): Promise<UserInterface | null>;
}

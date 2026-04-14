export { Role } from '../../../../shared/src/modules/user/shared.js';
import { Role } from '../../../../shared/src/modules/user/shared.js';

export class User {
  id!: number;
  email!: string;
  phone!: string;
  profileUrl!: string;
  role!: Role;
  passwordHash!: string;
  active!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}

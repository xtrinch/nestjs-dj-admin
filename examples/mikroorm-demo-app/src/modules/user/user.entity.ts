import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
export { Role } from '#examples-shared/modules/user/shared.js';
import { Role } from '#examples-shared/modules/user/shared.js';

@Entity({ tableName: 'users' })
export class User {
  @PrimaryKey({ autoincrement: true })
  id!: number;

  @Property({ unique: true })
  email!: string;

  @Property({ default: '' })
  phone = '';

  @Property({ default: '' })
  profileUrl = '';

  @Property()
  role!: Role;

  @Property()
  passwordHash!: string;

  @Property({ default: true })
  active = true;

  @Property({ onCreate: () => new Date() })
  createdAt = new Date();

  @Property({ onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt = new Date();
}

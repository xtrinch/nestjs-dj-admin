import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export { Role } from '../../../../shared/src/modules/user/shared.js';
import { Role } from '../../../../shared/src/modules/user/shared.js';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  email!: string;

  @Column({ default: '' })
  phone!: string;

  @Column({ default: '' })
  profileUrl!: string;

  @Column({
    type: 'enum',
    enum: Role,
  })
  role!: Role;

  @Column()
  passwordHash!: string;

  @Column({ default: true })
  active!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

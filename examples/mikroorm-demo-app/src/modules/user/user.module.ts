import { Module } from '@nestjs/common';
import { UserAdmin } from './user.admin.js';
import { UserService } from './user.service.js';

@Module({
  providers: [UserService, UserAdmin],
  exports: [UserService, UserAdmin],
})
export class UserModule {}

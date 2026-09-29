import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { GroupsModule } from './groups/groups.module';

@Module({
  imports: [PrismaModule, GroupsModule, UsersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

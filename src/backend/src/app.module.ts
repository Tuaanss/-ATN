import { Controller, Get, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { env } from './config/env';
import { PrismaModule, PrismaService } from './common/prisma/prisma.service';
import { AuditModule } from './common/audit/audit.service';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter';
import { JwtAuthGuard, RolesGuard } from './common/auth/auth.guards';
import { Public } from './common/auth/auth.decorators';
import { InfraModule } from './infra/infra.module';
import { AuthModule } from './modules/auth/auth.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { SubmissionsModule } from './modules/submissions/submissions.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { GradesModule } from './modules/grades/grades.module';
import { SearchModule } from './modules/search/search.module';
import { ProfileModule } from './modules/profile/profile.module';
import { NotesModule } from './modules/notes/notes.module';
import { StatsModule } from './modules/stats/stats.module';
import { SystemConfigModule } from './common/config/system-config.service';
import { AdminModule } from './modules/admin/admin.module';
import { ParentModule } from './modules/parent/parent.module';
import { EnterpriseModule } from './modules/enterprise/enterprise.module';

@Controller('health')
class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', driveMode: env.DRIVE_MODE, time: new Date().toISOString() };
  }
}

@Module({
  imports: [
    JwtModule.register({ global: true, secret: env.JWT_SECRET, signOptions: { expiresIn: env.JWT_EXPIRES_IN as never } }),
    PrismaModule,
    AuditModule,
    InfraModule,
    NotificationsModule,
    AuthModule,
    AssignmentsModule,
    SubmissionsModule,
    GradesModule,
    SearchModule,
    ProfileModule,
    NotesModule,
    StatsModule,
    SystemConfigModule,
    AdminModule,
    ParentModule,
    EnterpriseModule,
    DashboardModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}

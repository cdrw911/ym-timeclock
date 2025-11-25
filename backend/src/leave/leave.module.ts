import { Module } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { LeaveController, LeaveAdminController } from './leave.controller';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [IntegrationsModule],
  controllers: [LeaveController, LeaveAdminController],
  providers: [LeaveService],
  exports: [LeaveService],
})
export class LeaveModule {}

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { closeDemoBullMqInfrastructure, resetDemoBullMqQueues } from './demo-bullmq.js';

@Injectable()
export class DemoQueueService implements OnModuleDestroy {
  async reset(): Promise<void> {
    await resetDemoBullMqQueues();
  }

  async onModuleDestroy(): Promise<void> {
    await closeDemoBullMqInfrastructure();
  }
}

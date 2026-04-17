import { Controller, NotFoundException, Post } from '@nestjs/common';
import { DemoDataService } from './demo-data.service.js';

@Controller('__test')
export class DemoTestController {
  constructor(private readonly demoData: DemoDataService) {}

  @Post('reset')
  async reset() {
    if (process.env['ADMIN_E2E_ENABLE_RESET'] !== 'true') {
      throw new NotFoundException();
    }

    await this.demoData.reset();
    return { success: true };
  }
}

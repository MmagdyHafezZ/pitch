import { Controller, Get } from '@nestjs/common'

@Controller('user-metrics')
export class UserMetricsController {
  @Get()
  getUserMetrics() {
    return [{ id: 1, name: 'John Doe', metrics: { visits: 10, clicks: 20 } }]
  }
}

import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

export async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const port = Number(process.env.ANALYTICS_PORT ?? process.env.PORT ?? 3001)
  await app.listen(port)
}

/* istanbul ignore next */
if (require.main === module) {
  bootstrap()
}

import { Logger } from '@nestjs/common'

const logger = new Logger('HealthCheck')

const RETRY_ATTEMPTS = 20
const RETRY_DELAY_MS = 5000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function withRetry<T>(name: string, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      return await fn()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (attempt < RETRY_ATTEMPTS) {
        logger.warn(
          `⏳ ${name} not ready (attempt ${attempt}/${RETRY_ATTEMPTS}): ${errorMessage} — retrying in ${RETRY_DELAY_MS / 1000}s...`
        )
        await sleep(RETRY_DELAY_MS)
      } else {
        throw error
      }
    }
  }
  // unreachable, but TypeScript needs this
  throw new Error(`${name} failed after ${RETRY_ATTEMPTS} attempts`)
}

export interface PrismaLike {
  $connect(): Promise<void>
  $disconnect(): Promise<void>
  $queryRaw(query: TemplateStringsArray): Promise<any>
}

export async function checkRabbitMQConnection(rabbitmqUrl: string): Promise<void> {
  logger.log('🔍 Checking RabbitMQ connection...')

  await withRetry('RabbitMQ', async () => {
    const amqp = await import('amqplib')
    const connection = await amqp.connect(rabbitmqUrl)
    const channel = await connection.createChannel()
    await channel.close()
    await connection.close()
  })

  logger.log('✅ RabbitMQ connection successful')
}

export async function checkDatabaseConnection(prismaClient: PrismaLike): Promise<void> {
  logger.log('🔍 Checking database connection...')

  await withRetry('Database', async () => {
    await prismaClient.$connect()
    await prismaClient.$queryRaw`SELECT 1 as health_check`
  }).finally(() => prismaClient.$disconnect())

  logger.log('✅ Database connection successful')
}

export async function runStartupHealthChecks(
  rabbitmqUrl: string,
  prismaClient: PrismaLike
): Promise<void> {
  logger.log('🏥 Running startup health checks...')

  try {
    await Promise.all([checkRabbitMQConnection(rabbitmqUrl), checkDatabaseConnection(prismaClient)])
    logger.log('✅ All health checks passed')
  } catch (error) {
    logger.error('❌ Startup health checks failed after all retries')
    throw error
  }
}

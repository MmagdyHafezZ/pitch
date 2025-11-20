import { Logger } from '@nestjs/common'

const logger = new Logger('HealthCheck')

export interface PrismaLike {
  $connect(): Promise<void>
  $disconnect(): Promise<void>
  $queryRaw(query: TemplateStringsArray): Promise<any>
}

/**
 * Checks if RabbitMQ is accessible and connectable
 * Requires amqplib to be installed by the consumer
 * @param rabbitmqUrl - RabbitMQ connection URL
 * @throws Error if connection fails
 */
export async function checkRabbitMQConnection(rabbitmqUrl: string): Promise<void> {
  logger.log('🔍 Checking RabbitMQ connection...')

  try {
    const amqp = await import('amqplib')

    const connection = await amqp.connect(rabbitmqUrl)

    const channel = await connection.createChannel()
    await channel.close()
    await connection.close()

    logger.log('✅ RabbitMQ connection successful')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(`❌ RabbitMQ connection failed: ${errorMessage}`)
    logger.error('Please ensure RabbitMQ is running and the RABBITMQ_URL is correct')
    throw new Error(`RabbitMQ health check failed: ${errorMessage}`)
  }
}

/**
 * Checks if the database is accessible and connectable
 * @param prismaClient - Any Prisma client instance
 * @throws Error if connection fails
 */
export async function checkDatabaseConnection(prismaClient: PrismaLike): Promise<void> {
  logger.log('🔍 Checking database connection...')

  try {
    await prismaClient.$connect()

    await prismaClient.$queryRaw`SELECT 1 as health_check`

    logger.log('✅ Database connection successful')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(`❌ Database connection failed: ${errorMessage}`)
    logger.error('Please ensure the database is running and DATABASE_URL is correct')
    throw new Error(`Database health check failed: ${errorMessage}`)
  } finally {
    await prismaClient.$disconnect()
  }
}

/**
 * Runs all startup health checks
 * @param rabbitmqUrl - RabbitMQ connection URL
 * @param prismaClient - Any Prisma client instance
 * @throws Error if any health check fails
 */
export async function runStartupHealthChecks(
  rabbitmqUrl: string,
  prismaClient: PrismaLike
): Promise<void> {
  logger.log('🏥 Running startup health checks...')

  try {
    await Promise.all([checkRabbitMQConnection(rabbitmqUrl), checkDatabaseConnection(prismaClient)])

    logger.log('✅ All health checks passed')
  } catch (error) {
    logger.error('❌ Startup health checks failed')
    throw error
  }
}

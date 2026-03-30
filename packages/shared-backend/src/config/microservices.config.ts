import { Transport, MicroserviceOptions } from '@nestjs/microservices'

export interface MicroserviceConfig {
  name: string
  queue: string
}

export const RABBITMQ_DEAD_LETTER_EXCHANGE = 'pitch.services.dlx'

export const MICROSERVICES_CONFIG: MicroserviceConfig[] = [
  { name: 'USER_SERVICE', queue: 'user_queue' },
  { name: 'SIMULATION_SERVICE', queue: 'simulation_queue' },
  { name: 'ANALYTICS_SERVICE', queue: 'analytics_queue' },
  { name: 'SUPPORT_SERVICE', queue: 'support_queue' },
  { name: 'LTI_SERVICE', queue: 'lti_queue' },
  { name: 'S3_SERVICE', queue: 's3_queue' },
  { name: 'CRM_SERVICE', queue: 'crm_queue' },
  { name: 'JOBS_SERVICE', queue: 'jobs_queue' },
  { name: 'GATEWAY_SERVICE', queue: 'gateway_queue' },
]

/**
 * Creates microservice configuration options for RabbitMQ transport
 *
 * IMPORTANT: Requires RabbitMQ URL environment variable to be set.
 * - DEP_MODE=local -> RABBITMQ_URL (+ optional RABBITMQ_URL_SECONDARY)
 * - DEP_MODE=prod -> CLOUDAMQP_URL (+ optional CLOUDAMQP_URL_SECONDARY)
 * Format: amqp://user:password@host:port/vhost
 *
 * @param queue - Queue name for this microservice
 * @returns MicroserviceOptions configured for RabbitMQ
 * @throws Error if required RabbitMQ URL is not set
 */
export function createMicroserviceOptions(queue: string): MicroserviceOptions {
  const urls = getRabbitMQUrls()
  const primaryUrl = urls[0]

  return {
    transport: Transport.RMQ,
    options: {
      urls,
      queue,
      noAck: true,
      prefetchCount: 10,
      queueOptions: getQueueOptions(primaryUrl),
      socketOptions: {
        heartbeatIntervalInSeconds: 60,
      },
    },
  }
}

function getRabbitMQEnvConfig(): {
  primaryVar: 'RABBITMQ_URL' | 'CLOUDAMQP_URL'
  secondaryVar: 'RABBITMQ_URL_SECONDARY' | 'CLOUDAMQP_URL_SECONDARY'
  primaryUrl: string | undefined
  secondaryUrl: string | undefined
} {
  const mode = (process.env.DEP_MODE ?? '').trim().toLowerCase()
  const isProd = mode === 'prod' || mode === 'production'

  const primaryVar = isProd ? 'CLOUDAMQP_URL' : 'RABBITMQ_URL'
  const secondaryVar = isProd ? 'CLOUDAMQP_URL_SECONDARY' : 'RABBITMQ_URL_SECONDARY'

  const primaryAliases = isProd
    ? [primaryVar, 'RABBITMQ_URL' as const]
    : [primaryVar, 'CLOUDAMQP_URL' as const]
  const secondaryAliases = isProd
    ? [secondaryVar, 'RABBITMQ_URL_SECONDARY' as const]
    : [secondaryVar, 'CLOUDAMQP_URL_SECONDARY' as const]

  const readFirstSet = (vars: readonly string[]): string | undefined => {
    for (const varName of vars) {
      const value = process.env[varName]?.trim()
      if (value) return value
    }
    return undefined
  }

  return {
    primaryVar,
    secondaryVar,
    primaryUrl: readFirstSet(primaryAliases),
    secondaryUrl: readFirstSet(secondaryAliases),
  }
}

/**
 * Gets RabbitMQ connection URL from environment
 *
 * SECURITY: This function enforces that the correct RabbitMQ URL is set.
 * Never commit credentials to source control.
 *
 * @returns RabbitMQ connection URL
 * @throws Error if required RabbitMQ URL environment variable is not set
 */
export function getRabbitMQUrl(): string {
  return getRabbitMQUrls()[0]
}

/**
 * Gets RabbitMQ connection URLs in failover order (primary, then secondary).
 *
 * - DEP_MODE=local -> RABBITMQ_URL, RABBITMQ_URL_SECONDARY
 * - DEP_MODE=prod -> CLOUDAMQP_URL, CLOUDAMQP_URL_SECONDARY
 *   (cross-env aliases are also accepted for compatibility)
 */
export function getRabbitMQUrls(): string[] {
  const { primaryVar, primaryUrl, secondaryUrl } = getRabbitMQEnvConfig()

  if (!primaryUrl) {
    throw new Error(
      `${primaryVar} environment variable is required. ` +
        'Format: amqp://username:password@host:port/vhost'
    )
  }

  const urls = [primaryUrl, secondaryUrl]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)

  return [...new Set(urls)]
}

export function usesRabbitMqPolicyDeadLettering(rabbitmqUrl = getRabbitMQUrl()): boolean {
  try {
    const parsed = new URL(rabbitmqUrl)
    const vhost = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''))

    return vhost === 'pitch_local'
  } catch {
    return false
  }
}

export function getQueueOptions(rabbitmqUrl = getRabbitMQUrl()) {
  if (usesRabbitMqPolicyDeadLettering(rabbitmqUrl)) {
    return {
      durable: true,
    }
  }

  return getDeadLetterQueueOptions()
}

export function getDeadLetterQueueOptions() {
  return {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': RABBITMQ_DEAD_LETTER_EXCHANGE,
    },
  }
}

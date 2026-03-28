export function getRabbitMQUrl(): string {
  const mode = (process.env.DEP_MODE ?? '').trim().toLowerCase();
  const isProd = mode === 'prod' || mode === 'production';
  const url = isProd ? process.env.CLOUDAMQP_URL : process.env.RABBITMQ_URL;

  if (!url) {
    const missingVar = isProd ? 'CLOUDAMQP_URL' : 'RABBITMQ_URL';
    throw new Error(
      `${missingVar} environment variable is required. ` +
        'Format: amqp://username:password@host:port/vhost',
    );
  }

  return url;
}
export function getQueueOptions() {
  return {
    durable: true,
  };
}

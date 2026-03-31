FROM rabbitmq:3.13-management

# Enable required plugins
RUN rabbitmq-plugins enable --offline rabbitmq_management rabbitmq_management_agent

# Default credentials (override with CE env vars RABBITMQ_DEFAULT_USER / RABBITMQ_DEFAULT_PASS)
ENV RABBITMQ_DEFAULT_USER=admin
ENV RABBITMQ_DEFAULT_PASS=changeme
ENV RABBITMQ_DEFAULT_VHOST=/

# Expose management UI (HTTP — routable by Code Engine)
# Port 5672 (AMQP) is accessible only within the Code Engine project via internal DNS
EXPOSE 15672
EXPOSE 5672

# Code Engine health check hits the management API
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD rabbitmq-diagnostics -q ping || exit 1

# Use management UI as the primary HTTP port Code Engine will route to
CMD ["rabbitmq-server"]

import { ConsoleLogger } from '@nestjs/common';
import { AdminObservabilityService } from '../controllers/admin/admin-observability.service';

export class AdminRuntimeLogger extends ConsoleLogger {
  constructor(private readonly adminObservability: AdminObservabilityService) {
    super();
  }

  override debug(message: unknown, ...optionalParams: unknown[]) {
    super.debug(message as any, ...optionalParams);
    this.captureRuntimeLog('debug', message, optionalParams);
  }

  override verbose(message: unknown, ...optionalParams: unknown[]) {
    super.verbose(message as any, ...optionalParams);
    this.captureRuntimeLog('verbose', message, optionalParams);
  }

  private captureRuntimeLog(
    level: 'debug' | 'verbose',
    message: unknown,
    optionalParams: unknown[],
  ) {
    const contextCandidate = optionalParams.at(-1);
    const context =
      typeof contextCandidate === 'string' ? contextCandidate : undefined;
    const metadata = context ? optionalParams.slice(0, -1) : optionalParams;

    this.adminObservability.recordRuntimeLog({
      level,
      context,
      message: this.stringifyValue(message),
      details:
        metadata.length > 0
          ? {
              optionalParams: metadata.map((item) => this.toSerializable(item)),
            }
          : undefined,
    });
  }

  private stringifyValue(value: unknown) {
    if (typeof value === 'string') {
      return value;
    }

    if (value instanceof Error) {
      return value.message;
    }

    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private toSerializable(value: unknown): unknown {
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
    }

    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return value;
    }

    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return Object.prototype.toString.call(value);
    }
  }
}

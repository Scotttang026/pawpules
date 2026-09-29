/**
 * Monitoring and Error Logging Utility for PawPulse
 * Provides Sentry integration hook and structured event telemetry for administrators.
 */

export interface SystemLogEvent {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  category: 'auth' | 'ai' | 'firestore' | 'rescue_dispatch' | 'email_notify' | 'system';
  message: string;
  details?: any;
}

class MonitoringService {
  private logs: SystemLogEvent[] = [];
  private maxLogs = 100;

  constructor() {
    this.initGlobalHandlers();
  }

  private initGlobalHandlers() {
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        const msg = String(event.message || '');
        // Ignore benign Vite HMR websocket reconnection errors in cloud preview environment
        if (msg.includes('WebSocket') || msg.includes('[vite]') || msg.includes('vite')) {
          return;
        }

        this.captureError('Unhandled Window Error', {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
        });
      });

      window.addEventListener('unhandledrejection', (event) => {
        const reasonStr = typeof event.reason === 'string'
          ? event.reason
          : event.reason?.message || JSON.stringify(event.reason || '');

        // Ignore benign Vite HMR websocket reconnection errors in cloud preview environment
        if (
          reasonStr.includes('WebSocket') ||
          reasonStr.includes('closed without opened') ||
          reasonStr.includes('[vite]')
        ) {
          return;
        }

        this.captureError('Unhandled Promise Rejection', {
          reason: event.reason,
        });
      });
    }
  }

  public log(
    level: 'info' | 'warn' | 'error',
    category: SystemLogEvent['category'],
    message: string,
    details?: any
  ) {
    const event: SystemLogEvent = {
      id: `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      details,
    };

    this.logs.unshift(event);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    // Console output for development and container observability
    const prefix = `[PawPulse ${category.toUpperCase()}]`;
    if (level === 'error') {
      console.error(prefix, message, details || '');
    } else if (level === 'warn') {
      console.warn(prefix, message, details || '');
    } else {
      console.info(prefix, message, details || '');
    }
  }

  public captureError(errorOrMessage: unknown, context?: Record<string, any>) {
    const msg = errorOrMessage instanceof Error ? errorOrMessage.message : String(errorOrMessage);
    const stack = errorOrMessage instanceof Error ? errorOrMessage.stack : undefined;
    this.log('error', 'system', msg, { ...context, stack });
  }

  public getRecentLogs(): SystemLogEvent[] {
    return [...this.logs];
  }

  public clearLogs() {
    this.logs = [];
  }
}

export const monitoring = new MonitoringService();

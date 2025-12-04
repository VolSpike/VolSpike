import pino from 'pino'

export function createLogger() {
    const isDevelopment = process.env.NODE_ENV === 'development'

    return pino({
        level: process.env.LOG_LEVEL || 'info',
        transport: isDevelopment ? {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
            },
        } : undefined,
        formatters: {
            level: (label) => {
                return { level: label }
            },
        },
        timestamp: pino.stdTimeFunctions.isoTime,
    })
}

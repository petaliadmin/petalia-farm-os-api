import { LoggerModuleAsyncParams } from "nestjs-pino";

export const pinoConfig: LoggerModuleAsyncParams = {
  useFactory: () => ({
    pinoHttp: {
      level:
        process.env.LOG_LEVEL ||
        (process.env.NODE_ENV === "production" ? "info" : "debug"),
      transport:
        process.env.NODE_ENV !== "production"
          ? {
              target: "pino-pretty",
              options: {
                colorize: true,
                singleLine: false,
                translateTime: "SYS:standard",
                ignore: "pid,hostname",
              },
            }
          : undefined,
      // For CloudWatch/ECS, use JSON format (default)
      formatters:
        process.env.NODE_ENV === "production"
          ? {
              level: (label) => ({ level: label.toUpperCase() }),
              bindings: (bindings) => ({
                service: "petalia-api",
                environment: process.env.NODE_ENV,
                version: "2.0.0",
                ...bindings,
              }),
            }
          : undefined,
      serializers: {
        req: (req) => ({
          method: req.method,
          url: req.url,
          headers: {
            host: req.headers.host,
            "user-agent": req.headers["user-agent"],
          },
        }),
        res: (res) => ({
          statusCode: res.statusCode,
        }),
      },
    },
  }),
};

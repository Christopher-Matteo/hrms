const isProduction = process.env.NODE_ENV === "production";
const isVercel = !!process.env.VERCEL;

class ConsoleLogger {
  info(arg1: any, arg2?: any) {
    if (arg2) console.log(JSON.stringify({ level: "info", ...arg1, message: arg2 }));
    else console.log(JSON.stringify({ level: "info", message: arg1 }));
  }
  error(arg1: any, arg2?: any) {
    if (arg2) console.error(JSON.stringify({ level: "error", ...arg1, message: arg2 }));
    else console.error(JSON.stringify({ level: "error", message: arg1 }));
  }
  warn(arg1: any, arg2?: any) {
    if (arg2) console.warn(JSON.stringify({ level: "warn", ...arg1, message: arg2 }));
    else console.warn(JSON.stringify({ level: "warn", message: arg1 }));
  }
  debug(arg1: any, arg2?: any) {
    if (arg2) console.log(JSON.stringify({ level: "debug", ...arg1, message: arg2 }));
    else console.log(JSON.stringify({ level: "debug", message: arg1 }));
  }
  child() {
    return this;
  }
}

export const logger = isVercel
  ? (new ConsoleLogger() as any)
  : (() => {
      const pino = (globalThis as any).require("pino");
      return pino({
        level: process.env.LOG_LEVEL ?? "info",
        redact: [
          "req.headers.authorization",
          "req.headers.cookie",
          "res.headers['set-cookie']",
        ],
        ...(isProduction
          ? {}
          : {
              transport: {
                target: "pino-pretty",
                options: { colorize: true },
              },
            }),
      });
    })();

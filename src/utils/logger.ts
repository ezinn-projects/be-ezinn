export class Logger {
  private readonly context: string

  constructor(context: string) {
    this.context = context
  }

  info(message: string, ...args: any[]) {
    console.log(`[${this.context}] ${message}`, ...args)
  }

  error(message: string, ...args: any[]) {
    console.error(`[${this.context}] ${message}`, ...args)
  }

  warn(message: string, ...args: any[]) {
    console.warn(`[${this.context}] ${message}`, ...args)
  }

  debug(message: string, ...args: any[]) {
    console.debug(`[${this.context}] ${message}`, ...args)
  }
}

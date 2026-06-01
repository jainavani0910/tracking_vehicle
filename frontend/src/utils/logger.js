class Logger {
  constructor() {
    this.logs = [];
    this.listeners = new Set();
    this.maxLogs = 100;
  }

  log(level, message, context = null) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
      id: Math.random().toString(36).substring(7),
      timestamp,
      level, // 'INFO', 'WARN', 'ERROR'
      message,
      context: context ? JSON.stringify(context) : null,
    };

    this.logs.unshift(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    this.listeners.forEach((listener) => listener(this.logs));
    
    // Also output to console
    const formattedMessage = `[${level}] ${timestamp}: ${message}`;
    if (level === 'ERROR') {
      console.error(formattedMessage, context || '');
    } else if (level === 'WARN') {
      console.warn(formattedMessage, context || '');
    } else {
      console.log(formattedMessage, context || '');
    }
  }

  info(message, context = null) {
    this.log('INFO', message, context);
  }

  warn(message, context = null) {
    this.log('WARN', message, context);
  }

  error(message, context = null) {
    this.log('ERROR', message, context);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    // Initial call
    listener(this.logs);
    return () => this.listeners.delete(listener);
  }

  clear() {
    this.logs = [];
    this.listeners.forEach((listener) => listener(this.logs));
  }
}

export const logger = new Logger();

import { Injectable } from '@angular/core';

/**
 * Log levels for chess game events
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

/**
 * Service for logging chess game events and moves
 * Helps with debugging and move history tracking
 */
@Injectable({
  providedIn: 'root'
})
export class ChessGameLoggerService {
  private logs: Array<{ timestamp: Date; level: LogLevel; message: string; data?: any }> = [];
  private maxLogs = 1000;
  private enableConsoleOutput = true;

  /**
   * Logs a debug message
   */
  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * Logs an info message
   */
  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Logs a warning message
   */
  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Logs an error message
   */
  error(message: string, data?: any): void {
    this.log(LogLevel.ERROR, message, data);
  }

  /**
   * Logs a move in algebraic notation
   */
  logMove(moveNotation: string, fromPos: { row: number; col: number }, toPos: { row: number; col: number }): void {
    this.info(`Move: ${moveNotation}`, { from: fromPos, to: toPos });
  }

  /**
   * Internal logging method
   */
  private log(level: LogLevel, message: string, data?: any): void {
    const logEntry = {
      timestamp: new Date(),
      level,
      message,
      data
    };

    this.logs.push(logEntry);

    // Keep log size manageable
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    if (this.enableConsoleOutput) {
      const consoleMethod = level === LogLevel.ERROR ? 'error' :
                          level === LogLevel.WARN ? 'warn' :
                          level === LogLevel.DEBUG ? 'debug' : 'log';

      const timestamp = logEntry.timestamp.toISOString();
      const prefix = `[${timestamp}] [${level}]`;

      if (data !== undefined) {
        console[consoleMethod](`${prefix} ${message}`, data);
      } else {
        console[consoleMethod](`${prefix} ${message}`);
      }
    }
  }

  /**
   * Gets all logs
   */
  getLogs(): Array<{ timestamp: Date; level: LogLevel; message: string; data?: any }> {
    return [...this.logs];
  }

  /**
   * Filters logs by level
   */
  getLogsByLevel(level: LogLevel): Array<{ timestamp: Date; level: LogLevel; message: string; data?: any }> {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Clears all logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Enables or disables console output
   */
  setConsoleOutput(enabled: boolean): void {
    this.enableConsoleOutput = enabled;
  }

  /**
   * Exports logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}


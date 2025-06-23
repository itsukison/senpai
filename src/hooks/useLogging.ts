import { useEffect, useState } from 'react';
import { LogEntry, LogEventType, LogEventData } from '@/types/logging';

export const useLogging = (language: 'ja' | 'en') => {
  const [sessionId] = useState<string>(() => {
    // セッションIDを生成（ページリロードまで同一）
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  });

  const log = async (event: LogEventType, data: LogEventData) => {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      sessionId,
      language,
      event,
      data
    };

    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logEntry),
      });
    } catch (error) {
      console.error('Failed to send log:', error);
      // ログ送信失敗時も、アプリケーションの動作は継続
    }
  };

  return { log, sessionId };
};
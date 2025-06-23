export interface LogEntry {
  timestamp: string;
  sessionId: string;
  ipAddress?: string;
  language: 'ja' | 'en';
  event: LogEventType;
  data: LogEventData;
}

export type LogEventType = 
  | 'analysis_completed'  // AI分析完了（入力テキスト + AI回答）
  | 'suggestion_accepted' // 提案を反映
  | 'suggestion_rejected' // 戻すボタン
  | 'text_copied';       // クリップボードにコピー

export interface AnalysisCompletedData {
  context: string;
  originalMessage: string;
  aiResponse: {
    hasIssues: boolean;
    ai_receipt?: string;
    improvement_points?: string;
    suggestion?: string;
    reasoning?: string;
    issues?: string[];
  };
  processingTime?: number; // ミリ秒
}

export interface UserActionData {
  action: string;
  previousText?: string;
  newText?: string;
  suggestionId?: string;
}

export type LogEventData = AnalysisCompletedData | UserActionData;
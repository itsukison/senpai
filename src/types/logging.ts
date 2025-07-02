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
  | 'text_copied'        // クリップボードにコピー
  | 'detailed_analysis_toggled'; // 詳細分析の開閉

export interface AnalysisCompletedData {
  context: string;
  originalMessage: string;
  issue_pattern?: string[];
  aiResponse: {
    hasIssues: boolean;
    ai_receipt?: string;
    improvement_points?: string;
    detailed_analysis?: string;  // 追加
    suggestion?: string;
    reasoning?: string;
    issue_pattern?: string[];
  };
  processingTime?: number;
}
export interface UserActionData {
  action: string;
  previousText?: string;
  newText?: string;
  suggestionId?: string;
}

export type LogEventData = AnalysisCompletedData | UserActionData;
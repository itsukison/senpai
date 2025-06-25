"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ToneSuggestion } from "./ToneSuggestion";
import { Textarea } from "@/components/ui/textarea";
import { useLogging } from "@/hooks/useLogging"; //ログ保存機能
import { createConvo } from "@/lib/actions";

// 変更後
interface ToneAnalysis {
  hasIssues: boolean;
  originalText: string;
  suggestion: string | null;
  reasoning: string;
  ai_receipt?: string;
  improvement_points?: string;
  issue_pattern?: string[];      // 追加
  detected_mentions?: string[];  // 追加
}

interface ToneCheckerProps {
  isJapanese: boolean;
}

export function ToneChecker({ isJapanese }: ToneCheckerProps) {
  const [userDraft, setUserDraft] = useState("");
  const { log } = useLogging(isJapanese ? "ja" : "en"); // log保存用
  const [threadContext, setThreadContext] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestion, setSuggestion] = useState<ToneAnalysis | null>(null);
  const [lastAnalyzedText, setLastAnalyzedText] = useState("");
  const [originalText, setOriginalText] = useState(""); // 元のテキストを保存
  const [hasAcceptedSuggestion, setHasAcceptedSuggestion] = useState(false); // 提案を受け入れたかどうか
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>();

// Debounced analysis function - analyze full text
const analyzeText = useCallback(
  async (textToAnalyze: string) => {
    console.log("=== 解析開始 ===");
    console.log("入力文字数:", textToAnalyze.length);
    console.log("入力内容:", textToAnalyze);
    
    if (!textToAnalyze.trim() || textToAnalyze.length < 15) {
      setSuggestion(null);
      return;
    }

    setIsAnalyzing(true);
    const startTime = Date.now();

    try {
      const requestBody = {
        user_draft: textToAnalyze,
        thread_context: threadContext,
        language: isJapanese ? "japanese" : "english",
      };
      console.log("APIリクエスト:", requestBody);

      const response = await fetch("/api/check-tone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      console.log("APIレスポンスステータス:", response.status);

      if (!response.ok) {
        throw new Error("Failed to analyze text");
      }

      const analysis: ToneAnalysis = await response.json();
      console.log("APIレスポンス内容:", analysis);

      // 変更後
      await log("analysis_completed", {
        context: threadContext,
        originalMessage: textToAnalyze,
        issue_pattern: analysis.issue_pattern || [],  // 追加
        aiResponse: {
          hasIssues: analysis.hasIssues,
          ai_receipt: analysis.ai_receipt,
          improvement_points: analysis.improvement_points,
          suggestion: analysis.suggestion || undefined,
          reasoning: analysis.reasoning,
          issue_pattern: analysis.issue_pattern || [],  // 追加
        },
        processingTime: Date.now() - startTime,
      });

      // Log analysis data to Supabase
      try {
        const result = await createConvo({
          input: textToAnalyze,
          feedback: analysis.suggestion || ""
        });
        
        if (result) {
          console.log("Successfully logged to Supabase");
        } else {
          console.warn("Failed to log to Supabase, but continuing with analysis");
        }
      } catch (error) {
        console.error("Error logging to Supabase:", error);
      }

      console.log("hasIssues:", analysis.hasIssues);
      console.log("suggestion:", analysis.suggestion);

      // hasIssuesがfalseでもanalyisを設定する
      setSuggestion(analysis);
      console.log("分析結果を設定 - hasIssues:", analysis.hasIssues, "suggestion:", analysis.suggestion);

      setLastAnalyzedText(textToAnalyze);
    } catch (error) {
      console.error("エラー詳細:", error);
      setSuggestion(null);
    } finally {
      setIsAnalyzing(false);
      console.log("=== 解析終了 ===");
    }
  },
  [threadContext, isJapanese, log]
);

  // Handle text change with debouncing
  const handleTextChange = (value: string) => {
    setUserDraft(value);

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for analysis
    timeoutRef.current = setTimeout(() => {
      analyzeText(value);
    }, 1000); // 1 second delay
  };
  // Accept suggestion
  const acceptSuggestion = async () => {
    if (suggestion?.suggestion) {
      // 元のテキストを保存
      setOriginalText(userDraft);
      // 全文を置換
      setUserDraft(suggestion.suggestion);
      setLastAnalyzedText(suggestion.suggestion);
      setHasAcceptedSuggestion(true);
      textareaRef.current?.focus();

      // ログ記録
      await log("suggestion_accepted", {
        action: "accept",
        previousText: userDraft,
        newText: suggestion.suggestion,
      });
    }
  };

  // Revert to original text
  const revertToOriginal = async () => {
    if (originalText) {
      setUserDraft(originalText);
      setLastAnalyzedText(originalText);
      setHasAcceptedSuggestion(false);
      setOriginalText("");
      textareaRef.current?.focus();

      // ログ記録
      await log("suggestion_rejected", {
        action: "reject",
        previousText: userDraft,
        newText: originalText,
      });
    }
  };

  // Dismiss suggestion
  const dismissSuggestion = () => {
    setSuggestion(null);
    // Mark current text as analyzed to avoid re-analyzing
    setLastAnalyzedText(userDraft);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const labels = {
    contextTitle: isJapanese
      ? "過去のやりとり・会話の履歴"
      : "Conversation Context",
    contextPlaceholder: isJapanese
      ? "SlackやTeamsから、これまでの会話履歴をここにコピー & ペーストして、SenpAI Senseiが文脈を理解するのを助けてください。(回答の精度が上がります)"
      : "Paste your conversation history here so the AI can understand the context...",
    writeTitle: isJapanese
      ? "投稿予定のメッセージを書く"
      : "Write your message",
    writePlaceholder: isJapanese
      ? "ここに、これから相手に送ろうとしているメッセージを入力してください。　入力が進むと、自動的にAIの解析が始まります。"
      : "Start typing your message here... We'll help you make it more professional and respectful.",
    analyzing: isJapanese ? "分析中......" : "Analyzing...",
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-visible">
      {/* Responsive Grid Container */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 h-full min-h-0">
        {/* Context Input - Full width on mobile, left 1/3 on laptop+ */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden hover:shadow-xl transition-shadow duration-300 flex flex-col lg:col-span-1 min-h-[200px]">
          {/* Context Header */}
          <div className="px-4 sm:px-5 py-2 sm:py-3 border-b border-purple-200 bg-purple-50 flex-shrink-0">
            <h3 className="text-sm sm:text-base font-semibold text-purple-800 tracking-wide">
              {labels.contextTitle}
            </h3>
          </div>

          {/* Context Text Area */}
          <div className="relative flex-1 flex flex-col min-h-0">
            <Textarea
              value={threadContext}
              onChange={(e) => setThreadContext(e.target.value)}
              placeholder={labels.contextPlaceholder}
              className="flex-1 resize-none border-0 rounded-none focus-visible:ring-2 focus-visible:ring-slack-blue text-xs sm:text-sm leading-relaxed h-full"
              style={{ fontFamily: "Inter, sans-serif" }}
            />
          </div>
        </div>

        {/* Right Side Container - Message Input and Suggestions stacked vertically */}
        <div className="lg:col-span-2 flex flex-col gap-3 sm:gap-4 min-h-0">
          {/* Message Input - Top of right side */}
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden hover:shadow-xl transition-shadow duration-300 flex flex-col flex-1 min-h-[200px]">
            {/* Header */}
            <div className="px-4 sm:px-5 py-2 sm:py-3 border-b border-purple-200 bg-purple-50 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-sm sm:text-base font-semibold text-purple-800 tracking-wide">
                  {labels.writeTitle}
                </h3>
                <div className="flex items-center space-x-2 sm:space-x-3">
                  {isAnalyzing && (
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs sm:text-sm font-medium text-purple-700">
                        {labels.analyzing}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Text Area */}
            <div className="relative flex-1 flex flex-col min-h-0">
              <Textarea
                ref={textareaRef}
                value={userDraft}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder={labels.writePlaceholder}
                className="flex-1 resize-none border-0 rounded-none focus-visible:ring-2 focus-visible:ring-slack-blue text-xs sm:text-sm leading-relaxed h-full pb-12"
                style={{ fontFamily: "Inter, sans-serif" }}
              />

              {/* Slack風送信ボタン */}
              <div className="absolute bottom-2 right-2">
                <button
                  onClick={() => analyzeText(userDraft)}
                  disabled={userDraft.trim().length < 15 || isAnalyzing}
                  className={`
                    p-2 rounded-md transition-all duration-200
                    ${userDraft.trim().length >= 15 && !isAnalyzing
                      ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm hover:shadow-md' 
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }
                  `}
                  title={
                    isAnalyzing
                      ? isJapanese ? "解析中..." : "Analyzing..."
                      : userDraft.trim().length < 15
                      ? isJapanese ? "15文字以上入力してください" : "Enter at least 15 characters"
                      : isJapanese ? "メッセージを解析" : "Analyze message"
                  }
                >
                  {isAnalyzing ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg 
                      className={`w-5 h-5 transform transition-transform duration-200 ${
                        userDraft.trim().length >= 15 ? 'rotate-90' : 'rotate-45'
                      }`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" 
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Suggestion Box - Bottom of right side */}
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden hover:shadow-xl transition-shadow duration-300 flex flex-col flex-1 min-h-0">
            <div className="flex-1 flex flex-col min-h-0">
              {suggestion ? (
                <ToneSuggestion
                  suggestion={suggestion}
                  onAccept={() => acceptSuggestion()}
                  onDismiss={dismissSuggestion}
                  onRevert={() => revertToOriginal()}
                  hasAcceptedSuggestion={hasAcceptedSuggestion}
                  position={{ top: 0, left: 0 }}
                  isJapanese={isJapanese}
                  isEmbedded={true}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center bg-slate-50 p-3 sm:p-4">
                  <p className="text-slate-500 text-sm sm:text-base font-medium text-center max-w-sm whitespace-pre-line">
                    {isJapanese
                      ? "メッセージを入力するとSenpAI Senseiによる\nメッセージの改善案がここに表示されます"
                      : "Tone suggestions will appear here as you type your message"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
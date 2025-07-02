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
  detailed_analysis?: string;    // 新規追加
  issue_pattern?: string[];
  detected_mentions?: string[];
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
  const [currentAnalyzingText, setCurrentAnalyzingText] = useState<string>("");
  const [isUserInitiatedAnalysis, setIsUserInitiatedAnalysis] = useState(false); // ユーザーがボタンを押したか  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>();

  // 関係性セレクター用のstate
  const [hierarchy, setHierarchy] = useState('peer');
  const [social_distance, setSocialDistance] = useState('neutral');

  // 距離のサブテキスト
  const getDistanceSubtext = () => {
    const subtextMap: { [key: string]: string } = isJapanese
      ? {
          'close': '日常的に交流',
          'somewhat_close': '定期的に交流',
          'neutral': '業務上の関係',
          'somewhat_distant': '限定的な接点',
          'distant': '最小限の接点'
        }
      : {
          'close': 'Daily interaction',
          'somewhat_close': 'Regular interaction',
          'neutral': 'Professional relation',
          'somewhat_distant': 'Limited contact',
          'distant': 'Minimal contact'
        };
    return subtextMap[social_distance] || '';
  };

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

    // 既に同じテキストを解析中の場合は何もしない
    if (isAnalyzing && currentAnalyzingText === textToAnalyze) return;

    setIsAnalyzing(true);
    setCurrentAnalyzingText(textToAnalyze);
    const startTime = Date.now();

    try {
      const requestBody = {
        user_draft: textToAnalyze,
        thread_context: threadContext,
        language: isJapanese ? "japanese" : "english",
        hierarchy: hierarchy,
        social_distance: social_distance,
      };
      
      // 送信データの詳細をログ出力
      console.log("=== APIリクエスト詳細 ===");
      console.log("language:", requestBody.language);
      console.log("hierarchy:", requestBody.hierarchy);
      console.log("social_distance:", requestBody.social_distance);
      console.log("thread_context長さ:", requestBody.thread_context.length);
      console.log("完全なリクエストボディ:", JSON.stringify(requestBody, null, 2));

      const response = await fetch("/api/check-tone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      console.log("APIレスポンスステータス:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("APIエラーレスポンス:", errorText);
        throw new Error("Failed to analyze text");
      }

      const analysis: ToneAnalysis = await response.json();
      
      // レスポンスの詳細をログ出力
      console.log("=== APIレスポンス詳細 ===");
      console.log("hasIssues:", analysis.hasIssues);
      console.log("issue_pattern:", analysis.issue_pattern);
      console.log("ai_receipt:", analysis.ai_receipt);
      console.log("improvement_points:", analysis.improvement_points);
      console.log("detailed_analysis:", analysis.detailed_analysis);
      console.log("suggestion長さ:", analysis.suggestion?.length || 0);
      console.log("完全なレスポンス:", JSON.stringify(analysis, null, 2));

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
          feedback: analysis.suggestion || "",
          hierarchy: hierarchy,
          social_distance: social_distance,
          language: isJapanese ? "japanese" : "english",
          thread_context: threadContext,
          issue_pattern: analysis.issue_pattern || [],
          has_issues: analysis.hasIssues,
          ai_receipt: analysis.ai_receipt || "",
          improvement_points: analysis.improvement_points || "",
          detailed_analysis: analysis.detailed_analysis || "",
          reasoning: analysis.reasoning || "",
          detected_mentions: analysis.detected_mentions || [],
          timestamp: new Date().toISOString()
        });
        
        if (result) {
          console.log("Successfully logged to Supabase with full data");
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
      setIsUserInitiatedAnalysis(false); // 解析終了時にリセット
      console.log("=== 解析終了 ===");
    }
  },
  [threadContext, isJapanese, log, isAnalyzing, currentAnalyzingText, hierarchy, social_distance]
);

  // Handle text change with debouncing
  const handleTextChange = (value: string) => {
    setUserDraft(value);
    
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // 反映ボタンが押された後の編集では自動解析しない
    if (hasAcceptedSuggestion) {
      // テキストが変更されたら反映状態をリセット（でも自動解析はしない）
      if (value !== suggestion?.suggestion) {
        setHasAcceptedSuggestion(false);
      }
      return; // 自動解析しない
    }

    // Set new timeout for analysis
    timeoutRef.current = setTimeout(() => {
      analyzeText(value);
    }, 3000); // 3 seconds delay
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

  // レスポンシブなセレクターコンポーネント
  const RelationshipSelector = () => {
    const hierarchyOptionsWithDetails = isJapanese
      ? [
          { value: 'junior', label: '後輩・部下' },
          { value: 'peer', label: '同僚・対等' },
          { value: 'senior', label: '目上のかた' }
        ]
      : [
          { value: 'junior', label: 'Junior' },
          { value: 'peer', label: 'Peer' },
          { value: 'senior', label: 'Senior' }
        ];

    const distanceOptionsArray = isJapanese
      ? [
          { value: 'close', label: '近い' },
          { value: 'somewhat_close', label: 'やや近' },
          { value: 'neutral', label: '標準' },
          { value: 'somewhat_distant', label: 'やや遠' },
          { value: 'distant', label: '遠い' }
        ]
      : [
          { value: 'close', label: 'Close' },
          { value: 'somewhat_close', label: 'Rather Close' },
          { value: 'neutral', label: 'Neutral' },
          { value: 'somewhat_distant', label: 'Rather Distant' },
          { value: 'distant', label: 'Distant' }
        ];

    return (
      <div className="bg-purple-50 rounded-t-none rounded-b-lg px-4 py-2.5 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-stretch gap-2.5 sm:gap-6">
          {/* 宛先セクション */}
          <div className="flex-1 flex flex-col sm:flex-col">
            {/* PC版: ラベル上 / モバイル版: ラベル左 */}
            <div className="flex flex-row sm:flex-col items-center sm:items-stretch gap-2 sm:gap-1">
              <p className="text-[11px] font-semibold text-purple-800 whitespace-nowrap sm:mb-0 px-1.5 sm:px-0">
                {isJapanese ? '宛先' : 'To'}
              </p>
              <div className="flex space-x-1.5 flex-1 w-full">
                {hierarchyOptionsWithDetails.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setHierarchy(option.value)}
                    className={`flex-1 py-1.5 px-2 rounded-lg transition-all duration-200 min-h-[32px] sm:h-auto ${
                      hierarchy === option.value
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'bg-white text-purple-700 hover:bg-purple-100 shadow-sm border border-purple-200'
                    }`}
                  >
                    <p className="text-[10px] font-semibold">
                      {option.label}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="hidden sm:block w-px bg-purple-200" />

          {/* 距離セクション */}
          <div className="flex-1 flex flex-col sm:flex-col">
            {/* PC版: ラベル上 / モバイル版: ラベル左 */}
            <div className="flex flex-row sm:flex-col items-center sm:items-stretch gap-2 sm:gap-1">
              <p className="text-[11px] font-semibold text-purple-800 whitespace-nowrap sm:mb-0 px-1.5 sm:px-0">
                {isJapanese ? '距離' : 'Distance'}
              </p>
              <div className="bg-white rounded-lg p-0.5 shadow-inner flex space-x-0.5 flex-1 w-full">
                {distanceOptionsArray.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSocialDistance(option.value)}
                    className={`flex-1 py-1 px-1.5 rounded-md text-[10px] font-medium transition-all duration-200 flex flex-col justify-center min-h-[32px] sm:h-auto ${
                      social_distance === option.value
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-purple-700 hover:bg-purple-50'
                    }`}
                  >
                    <span className="block">{option.label}</span>
                    {social_distance === option.value && (
                      <span className="block text-[8px] opacity-80 mt-0.5 whitespace-nowrap">
                        {getDistanceSubtext()}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-visible p-2">
      {/* Responsive Grid Container */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 h-full min-h-0 max-h-[calc(100vh-140px)]">

        {/* Context Input - Full width on mobile, left 1/3 on laptop+ */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden hover:shadow-xl transition-shadow duration-300 flex flex-col lg:col-span-1 min-h-[200px] h-full">
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
        <div className="lg:col-span-2 flex flex-col gap-3 sm:gap-4 min-h-0 h-full">
          {/* Message Input - Top of right side */}
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden hover:shadow-xl transition-shadow duration-300 flex flex-col h-[40%] min-h-[250px] max-h-[400px]">
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

            {/* 関係性セレクター */}
            <RelationshipSelector />

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
              <div className="absolute bottom-2 right-4">

                <button
                  onClick={() => {
                    if (userDraft.trim().length < 15) return;
                    
                    // 既に解析済みで同じテキストの場合
                    if (!isAnalyzing && suggestion !== null && lastAnalyzedText === userDraft) {
                      return; // 何もしない
                    }
                    
                    // ユーザーがボタンを押したことを記録
                    setIsUserInitiatedAnalysis(true);
                    
                    // 既に解析中の場合は、フラグを立てるだけ
                    if (isAnalyzing && currentAnalyzingText === userDraft) {
                      return;
                    }
                    
                    // 解析を実行
                    analyzeText(userDraft);
                  }}

                  disabled={userDraft.trim().length < 15}
                  className={`
                    p-2 rounded-md transition-all duration-200
                    ${userDraft.trim().length >= 15
                      ? !isAnalyzing && suggestion !== null && lastAnalyzedText === userDraft
                        ? 'bg-gray-300 hover:bg-gray-400 text-gray-600 shadow-sm'  // 解析済み
                        : 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm hover:shadow-md'  // 通常
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'  // 無効
                    }
                  `}
                  title={
                    userDraft.trim().length < 15
                      ? isJapanese ? "15文字以上入力してください" : "Enter at least 15 characters"
                      : !isAnalyzing && suggestion !== null && lastAnalyzedText === userDraft
                        ? isJapanese ? "解析済み" : "Already analyzed"
                        : isJapanese ? "メッセージを解析" : "Analyze message"
                  }
                >
                  {/* ユーザーがボタンを押した場合のみローディング表示 */}
                  {isAnalyzing && isUserInitiatedAnalysis ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg 
                      className={`w-5 h-5 transform transition-transform duration-200 ${
                        userDraft.trim().length >= 15 
                          ? !isAnalyzing && suggestion !== null && lastAnalyzedText === userDraft
                            ? 'rotate-0'  // 解析済み
                            : 'rotate-90'  // 解析可能
                          : 'rotate-45'  // 無効
                      }`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      {!isAnalyzing && suggestion !== null && lastAnalyzedText === userDraft && userDraft.trim().length >= 15 ? (
                        // チェックマークアイコン（解析済み）
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M5 13l4 4L19 7" 
                        />
                      ) : (
                        // 紙飛行機アイコン（通常）
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" 
                        />
                      )}
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Suggestion Box - Bottom of right side */}
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden hover:shadow-xl transition-shadow duration-300 flex flex-col flex-1 min-h-[300px]">
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
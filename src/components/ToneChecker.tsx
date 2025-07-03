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
  const [analysisState, setAnalysisState] = useState<'ready' | 'analyzing' | 'analyzed'>('ready');
  const [suggestion, setSuggestion] = useState<ToneAnalysis | null>(null);
  const [originalText, setOriginalText] = useState(""); // 元のテキストを保存
  const [hasAcceptedSuggestion, setHasAcceptedSuggestion] = useState(false); // 提案を受け入れたかどうか
  const [acceptedSuggestionText, setAcceptedSuggestionText] = useState(""); // 反映した提案のテキスト
  const [isTransitioning, setIsTransitioning] = useState(false); // アニメーション状態
  const [showSuggestionArea, setShowSuggestionArea] = useState(false); // 提案エリアの表示状態
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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

// 合計文字数を取得
  const getTotalTextLength = () => {
    return threadContext.trim().length + userDraft.trim().length;
  };

  // 解析可能かどうか
  const canAnalyze = getTotalTextLength() >= 8;

  // 文字列の編集距離を簡易的に計算
  const getEditDistance = (str1: string, str2: string): number => {
    const lengthDiff = Math.abs(str1.length - str2.length);
    const commonLength = Math.min(str1.length, str2.length);
    let differences = 0;
    
    for (let i = 0; i < commonLength; i++) {
      if (str1[i] !== str2[i]) differences++;
    }
    
    return lengthDiff + differences;
  };

  // 有意な変更があるかどうか
  const hasSignificantChange = () => {
    if (!hasAcceptedSuggestion || !acceptedSuggestionText) return true;
    
    const editDistance = getEditDistance(userDraft, acceptedSuggestionText);
    return editDistance > 5;
  };

// Debounced analysis function - analyze full text
const analyzeText = useCallback(
  async () => {
    console.log("=== 解析開始 ===");
    console.log("合計文字数:", getTotalTextLength());
    console.log("user_draft:", userDraft);
    console.log("thread_context長さ:", threadContext.length);
    
    if (!canAnalyze) {
      return;
    }

    // アニメーション開始
    setIsTransitioning(true);
    setShowSuggestionArea(true);
    
    // 解析開始時に空のsuggestionをセット（スケルトンUI表示用）
    setSuggestion({
      hasIssues: true,  // デフォルトでtrueと仮定
      originalText: userDraft,
      suggestion: null,
      reasoning: '',
      ai_receipt: '',
      improvement_points: '',
      detailed_analysis: '',
      issue_pattern: [],
      detected_mentions: []
    });
    
    setTimeout(() => {
      setIsTransitioning(false);
    }, 500);

    // 既存の解析をキャンセル
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 新しいAbortControllerを作成
    abortControllerRef.current = new AbortController();
    
    setAnalysisState('analyzing');
    const startTime = Date.now();

    try {
      const requestBody = {
        user_draft: userDraft,  // textToAnalyze を userDraft に変更
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
        signal: abortControllerRef.current.signal,
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
        originalMessage: userDraft,
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
          input: userDraft,
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


    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('解析がキャンセルされました');
        return;
      }
      console.error("エラー詳細:", error);
      setSuggestion(null);
    } finally {
      setAnalysisState('analyzed');
      console.log("=== 解析終了 ===");
    }
  },
  [threadContext, userDraft, isJapanese, log, hierarchy, social_distance, canAnalyze]
);

  // Handle text change with debouncing
  const handleTextChange = (value: string) => {
    setUserDraft(value);
    
    // 解析済みの場合、ready状態に戻す
    if (analysisState === 'analyzed') {
      setAnalysisState('ready');
    }

    // 反映ボタンが押された後の編集
    if (hasAcceptedSuggestion && value !== acceptedSuggestionText) {
      if (hasSignificantChange()) {
        setHasAcceptedSuggestion(false);
        setAcceptedSuggestionText("");
      }
    }
  };

  // 提案の編集を処理
  const handleSuggestionEdit = (newText: string) => {
    if (suggestion) {
      setSuggestion({
        ...suggestion,
        suggestion: newText
      });
    }
  };

    // Accept suggestion
    const acceptSuggestion = async () => {
      if (suggestion?.suggestion) {
        // 元のテキストを保存
        setOriginalText(userDraft);
        // 全文を置換
        setUserDraft(suggestion.suggestion);
        setAcceptedSuggestionText(suggestion.suggestion);
        setHasAcceptedSuggestion(true);
        setAnalysisState('analyzed');
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
      setAnalysisState('ready');
      setHasAcceptedSuggestion(false);
      setAcceptedSuggestionText("");
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
    setAnalysisState('analyzed');
    setShowSuggestionArea(false);
  };

  // ========== ここに言語切り替えの検知を追加 ==========
  // 言語切り替えを検知
  useEffect(() => {
    setAnalysisState('ready');
  }, [isJapanese]);

  // 各種設定変更を検知
  useEffect(() => {
    if (analysisState === 'analyzed') {
      setAnalysisState('ready');
    }
  }, [threadContext, hierarchy, social_distance]);
  // ========== 言語切り替えの検知ここまで ==========

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);


  // ========== ここにショートカットキーの実装を追加 ==========
  // ショートカットキーの実装
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (canAnalyze && analysisState === 'ready' && (!hasAcceptedSuggestion || hasSignificantChange())) {
          analyzeText();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [canAnalyze, analysisState, hasAcceptedSuggestion, analyzeText]);
  // ========== ショートカットキーの実装ここまで ==========


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
      ? "ここに、これから相手に送ろうとしているメッセージを入力してください。　入力後、右下の送信/解析ボタンをクリックしてください。"
      : "Start typing your message here... Click the analyze button when ready.",
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
                    onClick={() => {
  setHierarchy(option.value);
  // 解析中の場合はキャンセル
  if (analysisState === 'analyzing' && abortControllerRef.current) {
    abortControllerRef.current.abort();
  }
  // 解析済みの場合、ready状態に戻す
  if (analysisState === 'analyzed') {
    setAnalysisState('ready');
  }
}}
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
                    onClick={() => {
                      setSocialDistance(option.value);
                      // 解析中の場合はキャンセル
                      if (analysisState === 'analyzing' && abortControllerRef.current) {
                        abortControllerRef.current.abort();
                      }
                      // 解析済みの場合、ready状態に戻す
                      if (analysisState === 'analyzed') {
                        setAnalysisState('ready');
                      }
                    }}
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
          <div className={`transition-all duration-500 ${
            isTransitioning && analysisState === 'analyzing' 
              ? 'opacity-0 -translate-y-4' 
              : 'opacity-100 translate-y-0'
          } ${showSuggestionArea ? 'hidden' : 'block'}`}>
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden hover:shadow-xl transition-shadow duration-300 flex flex-col h-[40%] min-h-[250px] max-h-[400px]">
              {/* Header */}
              <div className="px-4 sm:px-5 py-2 sm:py-3 border-b border-purple-200 bg-purple-50 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm sm:text-base font-semibold text-purple-800 tracking-wide">
                    {labels.writeTitle}
                  </h3>
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    {analysisState === 'analyzing' && (
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
                  className="flex-1 resize-none border-0 rounded-none focus-visible:ring-0 text-xs sm:text-sm leading-relaxed h-full pb-12"
                  style={{ fontFamily: "Inter, sans-serif" }}
                />

                {/* Slack風送信ボタン */}
                <div className="absolute bottom-2 right-4">

                  <button
                    onClick={() => {
                      if (!canAnalyze) return;
                      
                      // 既に解析済みの場合（反映後の有意でない変更）
                      if (hasAcceptedSuggestion && !hasSignificantChange()) {
                        return;
                      }
                      
                      // 解析を実行
                      analyzeText();
                    }}

                    disabled={!canAnalyze || (hasAcceptedSuggestion && !hasSignificantChange())}
                    className={`
                      p-2 rounded-md transition-all duration-200
                      ${canAnalyze && (!hasAcceptedSuggestion || hasSignificantChange())
                        ? analysisState === 'analyzed'
                          ? 'bg-gray-300 hover:bg-gray-400 text-gray-600 shadow-sm'  // 解析済み
                          : `bg-purple-600 hover:bg-purple-700 text-white shadow-sm hover:shadow-md
                             ${userDraft.length > 50 && analysisState === 'ready' ? 'pulse-animation' : ''}`  // 解析可能
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'  // 無効
                      }
                    `}
                    title={
                      getTotalTextLength() < 8
                        ? isJapanese 
                          ? `もう少しテキストを入力してください（あと${8 - getTotalTextLength()}文字）` 
                          : `Please enter more text (${8 - getTotalTextLength()} more characters needed)`
                        : hasAcceptedSuggestion && !hasSignificantChange()
                          ? isJapanese ? "変更が少ないため再解析不要" : "No significant changes to analyze"
                          : analysisState === 'analyzed'
                            ? isJapanese ? "解析済み" : "Already analyzed"
                            : isJapanese ? "メッセージを解析 (Ctrl+Enter)" : "Analyze message (Ctrl+Enter)"
                    }
                  >
                    {analysisState === 'analyzing' ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg 
                        className={`w-5 h-5 transform transition-transform duration-200 ${
                          canAnalyze && (!hasAcceptedSuggestion || hasSignificantChange())
                            ? analysisState === 'analyzed'
                              ? 'rotate-0'  // 解析済み
                              : 'rotate-90'  // 解析可能
                            : 'rotate-45'  // 無効
                        }`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        {analysisState === 'analyzed' && canAnalyze ? (
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
          </div>

          {/* Suggestion Box - Bottom of right side */}
          <div className={`bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden hover:shadow-xl transition-shadow duration-300 flex flex-col ${
            showSuggestionArea ? 'flex-1' : 'flex-1 min-h-[300px]'
          } ${
            showSuggestionArea && isTransitioning 
              ? 'animate-in slide-in-from-bottom duration-500' 
              : ''
          }`}>
            <div className="flex-1 flex flex-col min-h-0">
              {suggestion && showSuggestionArea ? (
                <ToneSuggestion
                  suggestion={suggestion}
                  onAccept={() => acceptSuggestion()}
                  onDismiss={dismissSuggestion}
                  onRevert={() => revertToOriginal()}
                  onSuggestionEdit={handleSuggestionEdit}
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
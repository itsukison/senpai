"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ToneSuggestion } from "./ToneSuggestion";
import { MessageEditor } from "./MessageEditor";
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
  const [externalChanges, setExternalChanges] = useState(false); // 外部変更フラグ
  const [animationPhase, setAnimationPhase] = useState<'input' | 'transitioning' | 'suggestion'>('input'); // アニメーションフェーズ
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isFirstAnalysis, setIsFirstAnalysis] = useState(true); // 初回解析かどうか
  const [isReanalyzing, setIsReanalyzing] = useState(false); // 再解析中かどうか
  const [displayText, setDisplayText] = useState<string>(''); // 表示用テキスト（ランダムアニメーション用）
  const [isShowingRandomText, setIsShowingRandomText] = useState(false); // ランダムテキスト表示中

  // 関係性セレクター用のstate
  const [hierarchy, setHierarchy] = useState('peer');
  const [social_distance, setSocialDistance] = useState('neutral');

  // 解析履歴の管理
  const [analysisHistory, setAnalysisHistory] = useState<Array<{
    timestamp: Date;
    original: string;
    suggestion: string;
    settings: { hierarchy: string; socialDistance: string; };
  }>>([]);


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
    console.log("初回解析:", isFirstAnalysis);
    console.log("提案エリア表示中:", showSuggestionArea);
    
    if (!canAnalyze) {
      return;
    }

    // 再解析かどうかを判定
    const isReanalysis = showSuggestionArea && !isFirstAnalysis;
    setIsReanalyzing(isReanalysis);

    if (isReanalysis) {
      // 再解析時：移動アニメーションなし、内容のフェードのみ
      setIsTransitioning(true);
      setExternalChanges(false);
    } else {
      // 初回解析時：フルアニメーション
      setAnimationPhase('transitioning');
      setIsTransitioning(true);
      setExternalChanges(false);
      
      // 即座に提案エリアを表示（移動開始）
      setShowSuggestionArea(true);
      
      // アニメーション完了（1.2秒に延長）
      setTimeout(() => {
        setAnimationPhase('suggestion');
        setIsTransitioning(false);
        setIsFirstAnalysis(false);
      }, 1200);
    }
    
    // モバイルの場合、スクロール調整（初回のみ）
    if (!isReanalysis && window.innerWidth < 768) {
      setTimeout(() => {
        const suggestionElement = document.querySelector('.suggestion-container');
        if (suggestionElement) {
          suggestionElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 600);
    }
    
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

      // 解析履歴に追加（成功時のみ、最大3件保持）
      if (analysis.suggestion) {
        setAnalysisHistory(prev => {
          const newHistory = [{
            timestamp: new Date(),
            original: userDraft,
            suggestion: analysis.suggestion!,
            settings: { hierarchy, socialDistance: social_distance }
          }, ...prev].slice(0, 3);
          return newHistory;
        });
      }

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
    // ランダムテキスト表示中は編集を無視
    if (isShowingRandomText) {
      return;
    }
    
    setUserDraft(value);
    setDisplayText(value);
    
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
      
      // MessageEditorにフォーカスを戻すための処理は後で追加

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
    // アニメーションを逆再生
    setAnimationPhase('transitioning');
    setIsTransitioning(true);
    
    // 段階的に戻す
    setTimeout(() => {
      setAnimationPhase('input');
    }, 300);
    
    setTimeout(() => {
      setShowSuggestionArea(false);
      setSuggestion(null);
      setAnalysisState('ready');
      setIsTransitioning(false);
      setIsFirstAnalysis(true); // リセット
      setIsReanalyzing(false);
    }, 1200);
  };

// ランダムテキストアニメーション
  useEffect(() => {
    if (!suggestion || !showSuggestionArea) {
      setDisplayText(userDraft);
      return;
    }

    let animationFrame: number | undefined;
    let isTransitioningToReal = false;

    // ランダムな文字を生成する関数
    const generatePartialRandomText = (baseText: string, progress: number): string => {
      const lines = baseText.split('\n');
      const randomChars = isJapanese 
        ? 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン会議資料確認共有関係者様連絡報告検討案件対応業務作業完了予定本日明日今週来週以降担当部署課長部長様方皆様御中ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        : 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?αβγδεζηθικλμνξοπρστυφχψω';
      
      return lines.map((line, lineIndex) => {
        if (!line) return line;
        
        return line.split('').map((char, charIndex) => {
          if (char === ' ' || char === '\n') return char;
          
          const waveOffset = Math.sin((lineIndex * 3 + charIndex * 0.5 + Date.now() * 0.001)) * 0.5 + 0.5;
          const randomThreshold = progress * (0.7 + waveOffset * 0.3);
          
          if (Math.random() < randomThreshold) {
            return randomChars[Math.floor(Math.random() * randomChars.length)];
          } else {
            return char;
          }
        }).join('');
      }).join('\n');
    };

    // 実際の結果への遷移アニメーション
    const transitionToReal = (targetText: string) => {
      isTransitioningToReal = true;
      const startTime = Date.now();
      const duration = 200;
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1, elapsed / duration);
        
        if (progress >= 1) {
          setDisplayText(targetText);
          setIsShowingRandomText(false);
          return;
        }
        
        const lines = targetText.split('\n');
        const result = lines.map(line => {
          if (!line) return line;
          
          return line.split('').map((char, index) => {
            const charProgress = progress + (Math.random() * 0.2 - 0.1);
            
            if (charProgress > Math.random()) {
              return char;
            } else {
              const randomChars = isJapanese 
                ? 'あいうえおかきくけこさしすせそたちつてとなにぬねのアイウエオカキクケコ会議資料確認共有連絡報告'
                : 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
              return randomChars[Math.floor(Math.random() * randomChars.length)];
            }
          }).join('');
        }).join('\n');
        
        setDisplayText(result);
        animationFrame = requestAnimationFrame(animate);
      };
      
      animate();
    };

    // AIの実際の改善案が来たら、遷移アニメーションを開始
    if (suggestion.suggestion && !isTransitioningToReal && isShowingRandomText) {
      transitionToReal(suggestion.suggestion);
      return;
    }

    // 改善案がまだない場合、2秒後からランダムテキストアニメーション
    if (!suggestion.suggestion && analysisState === 'analyzing') {
      setDisplayText(suggestion.originalText);
      
      const startTimer = setTimeout(() => {
        setIsShowingRandomText(true);
        const animationStartTime = Date.now();
        
        let frameCount = 0;
        const continuousAnimate = () => {
          if (suggestion.suggestion) {
            transitionToReal(suggestion.suggestion);
            return;
          }
          
          frameCount++;
          if (frameCount % 12 === 0) {
            const elapsed = Date.now() - animationStartTime;
            const progress = Math.min(1, elapsed / 2000);
            
            const partiallyRandomText = generatePartialRandomText(suggestion.originalText, progress);
            setDisplayText(partiallyRandomText);
          }
          
          animationFrame = requestAnimationFrame(continuousAnimate);
        };
        
        continuousAnimate();
      }, 2000);
      
      return () => {
        clearTimeout(startTimer);
        if (animationFrame !== undefined) {
          cancelAnimationFrame(animationFrame);
        }
      };
    } else if (suggestion.suggestion) {
      // 既に改善案がある場合は即座に表示
      setDisplayText(suggestion.suggestion);
      setIsShowingRandomText(false);
    }

    return () => {
      if (animationFrame !== undefined) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [suggestion, showSuggestionArea, analysisState, isJapanese]);

  // 言語切り替えを検知
  useEffect(() => {
    setAnalysisState('ready');
    if (showSuggestionArea) {
      setExternalChanges(true);
    }
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

  return (

    <div className="flex-1 flex flex-col overflow-visible p-2">
      {/* Responsive Grid Container */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 min-h-[500px] lg:min-h-0 max-h-[calc(100vh-140px)]">

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
            <textarea
              value={threadContext}
              onChange={(e) => {
                setThreadContext(e.target.value);
                if (showSuggestionArea && analysisState === 'analyzed') {
                  setExternalChanges(true);
                }
              }}
              placeholder={labels.contextPlaceholder}
              className={`flex-1 resize-none border-0 rounded-none focus-visible:ring-2 focus-visible:ring-purple-500 text-xs sm:text-sm leading-relaxed transition-all duration-300 overflow-y-auto px-3 py-2 bg-white text-gray-900 ${
                // モバイルでの高さ制御
                analysisState === 'analyzed' 
                  ? 'min-h-[60px] sm:min-h-full' 
                  : 'min-h-[120px] sm:min-h-full'
              }`}
              style={{ 
                fontFamily: "Inter, sans-serif",
                minHeight: '120px'
              }}
            />
          </div>
        </div>

        {/* Right Side Container - Message Input and Suggestions */}
        <div className="lg:col-span-2 flex flex-col gap-3 sm:gap-4">
          {/* 統合コンテナ - 常に表示、拡張アニメーション */}
          <div className={`bg-white rounded-xl shadow-lg border border-slate-200 hover:shadow-xl transition-all duration-1000 ${
            showSuggestionArea ? '' : ''
          }`}>
            {/* 解析後の追加要素（上部） */}
            {showSuggestionArea && suggestion && (
              <div className={`transition-all duration-500 overflow-hidden ${
                animationPhase === 'suggestion' 
                  ? 'max-h-[2000px] opacity-100' 
                  : 'max-h-0 opacity-0'
              }`}>
                <div className="p-5 space-y-4">
                  {/* ヘッダー with アイコン */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl">
                        {suggestion.hasIssues ? '💡' : '❤️'}
                      </span>
                      <h3 className="text-base font-bold text-slate-800">
                        {suggestion.hasIssues 
                          ? (isJapanese ? "改善提案" : "Improvement Suggestion")
                          : (isJapanese ? "素敵なメッセージです" : "Great message!")}
                      </h3>
                    </div>
                    <button
                      onClick={dismissSuggestion}
                      className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* AI Receipt */}
                  <div className="text-sm text-slate-700 leading-relaxed min-h-[40px]">
                    {(suggestion.ai_receipt || suggestion.reasoning) ? (
                      suggestion.ai_receipt || suggestion.reasoning
                    ) : (
                      <div className="flex items-center justify-center h-10">
                        <div className="flex space-x-2">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 改善ポイント / Goodポイント */}
                  {suggestion.hasIssues ? (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-slate-700">
                        {isJapanese ? "改善ポイント" : "Improvement Points"}
                      </h4>
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 min-h-[80px]">
                        {suggestion.improvement_points ? (
                          <p className="text-sm text-slate-700 leading-relaxed">
                            {suggestion.improvement_points}
                          </p>
                        ) : (
                          <div className="flex items-center justify-center h-16">
                            <div className="flex space-x-2">
                              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-slate-700">
                        {isJapanese ? "Goodポイント" : "Strengths"}
                      </h4>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <p className="text-sm text-slate-700 leading-relaxed">
                          {suggestion.improvement_points}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* セクションタイトル */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-slate-700">
                      {suggestion.hasIssues 
                        ? (isJapanese ? "改善案" : "Suggestion")
                        : (isJapanese ? "あなたのメッセージ" : "Your message")}
                    </h4>
                    
                    {!suggestion.hasIssues && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-sm text-blue-800 font-medium flex items-center gap-2">
                          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {isJapanese ? "このまま送信OKです！" : "Ready to send!"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* MessageEditor - 常に表示、位置が変化 */}
            <div className={`transition-all ease-out ${
              showSuggestionArea && animationPhase === 'transitioning' && !isReanalyzing
                ? 'transform translate-y-4 opacity-90 duration-1000' 
                : 'transform translate-y-0 opacity-100 duration-300'
            }`}>
              <MessageEditor
                mode={showSuggestionArea ? "suggestion" : "input"}
                text={showSuggestionArea && (isShowingRandomText || !suggestion?.suggestion) ? displayText : userDraft}
                onTextChange={handleTextChange}
                hierarchy={hierarchy}
                socialDistance={social_distance}
                onHierarchyChange={(value) => {
                  setHierarchy(value);
                  if (analysisState === 'analyzing' && abortControllerRef.current) {
                    abortControllerRef.current.abort();
                  }
                  if (analysisState === 'analyzed' && !showSuggestionArea) {
                    setAnalysisState('ready');
                  }
                }}
                onSocialDistanceChange={(value) => {
                  setSocialDistance(value);
                  if (analysisState === 'analyzing' && abortControllerRef.current) {
                    abortControllerRef.current.abort();
                  }
                  if (analysisState === 'analyzed' && !showSuggestionArea) {
                    setAnalysisState('ready');
                  }
                }}
                onAnalyze={() => {
                  if (!canAnalyze) return;
                  if (hasAcceptedSuggestion && !hasSignificantChange()) {
                    return;
                  }
                  analyzeText();
                }}
                analysisState={analysisState}
                canAnalyze={canAnalyze}
                isJapanese={isJapanese}
                hasAcceptedSuggestion={hasAcceptedSuggestion}
                hasSignificantChange={hasSignificantChange()}
                analysisHistory={analysisHistory}
                onHistorySelect={(index) => {
                  const history = analysisHistory[index];
                  setUserDraft(history.original);
                  setHierarchy(history.settings.hierarchy);
                  setSocialDistance(history.settings.socialDistance);
                  setAnalysisState('ready');
                }}
                isEditable={!isShowingRandomText} // ランダムテキスト表示中は編集不可
                isTransitioning={isTransitioning}
                title={showSuggestionArea 
                  ? (isJapanese ? "投稿予定のメッセージ（編集可能）" : "Message to send (editable)")
                  : undefined
                }
                externalChanges={externalChanges}
              />
            </div>
          </div>

          {/* プレースホルダー（解析前のみ） */}
          {!showSuggestionArea && (
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden flex-1 min-h-[300px]">
              <div className="flex-1 flex items-center justify-center bg-slate-50 p-3 sm:p-4 h-full">
                <p className="text-slate-500 text-sm sm:text-base font-medium text-center max-w-sm whitespace-pre-line">
                  {isJapanese
                    ? "メッセージを入力するとSenpAI Senseiによる\nメッセージの改善案がここに表示されます"
                    : "Tone suggestions will appear here as you type your message"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
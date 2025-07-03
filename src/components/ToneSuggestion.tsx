"use client";

import { useEffect, useState } from "react";
import { useLogging } from "@/hooks/useLogging";
import { ChevronDown, ChevronUp } from "lucide-react";

interface ToneAnalysis {
  hasIssues: boolean;
  originalText: string;
  suggestion: string | null;
  reasoning: string;
  ai_receipt?: string;
  improvement_points?: string;
  detailed_analysis?: string;  // 新規追加
  issue_pattern?: string[];
  detected_mentions?: string[];
}

interface ToneSuggestionProps {
  suggestion: ToneAnalysis;
  onAccept: () => void;
  onDismiss: () => void;
  onRevert?: () => void;
  onSuggestionEdit?: (text: string) => void;  // 追加
  hasAcceptedSuggestion?: boolean;
  position: { top: number; left: number };
  isJapanese: boolean;
  isEmbedded?: boolean;
}

export function ToneSuggestion({
  suggestion,
  onAccept,
  onDismiss,
  onRevert,
  onSuggestionEdit,
  hasAcceptedSuggestion = false,
  position,
  isJapanese,
  isEmbedded = false,
}: ToneSuggestionProps) {
  // showCopyFeedback state をコンポーネントのトップレベルで定義
  const [showCopyFeedback, setShowCopyFeedback] = useState(false);
  const [showDetailedAnalysis, setShowDetailedAnalysis] = useState(false);
  const [isShowingOriginal, setIsShowingOriginal] = useState(false); // 追加：オリジナルを表示中かどうか
  const [displayText, setDisplayText] = useState<string>(''); // 表示用テキスト
  const [isTransitioning, setIsTransitioning] = useState(false); // テキスト変化中かどうか
  const { log } = useLogging(isJapanese ? "ja" : "en"); // log取得用


// テキストの段階的変化を実装
  useEffect(() => {
    if (!suggestion.originalText) {
      setDisplayText('');
      return;
    }

    let animationFrame: number | undefined;
    let transitionTimer: NodeJS.Timeout | undefined;
    let isTransitioningToReal = false;

    // ランダムな文字を生成する関数
    const generateRandomText = (baseText: string): string => {
      const lines = baseText.split('\n');
      const randomChars = isJapanese 
        ? 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン会議資料確認共有関係者様連絡報告検討案件対応業務作業完了予定本日明日今週来週以降担当部署課長部長様方皆様御中心理的安全性話助挑新0000000001111111111ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?'
        : 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?αβγδεζηθικλμνξοπρστυφχψωÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ';
      
      return lines.map(line => {
        if (!line) return line;
        
        return line.split('').map(char => {
          // スペースと改行は維持
          if (char === ' ' || char === '\n') return char;
          
          // ランダムな文字に置き換え
          return randomChars[Math.floor(Math.random() * randomChars.length)];
        }).join('');
      }).join('\n');
    };

// 部分的にランダムな文字を生成する関数
    const generatePartialRandomText = (baseText: string, progress: number): string => {
      const lines = baseText.split('\n');
      const randomChars = isJapanese 
        ? 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン会議資料確認共有関係者様連絡報告検討案件対応業務作業完了予定本日明日今週来週以降担当部署課長部長様方皆様御中心理的安全性話助挑新0000000001111111111ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?'
        : 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?αβγδεζηθικλμνξοπρστυφχψωÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ';
      
      return lines.map((line, lineIndex) => {
        if (!line) return line;
        
        return line.split('').map((char, charIndex) => {
          // スペースと改行は維持
          if (char === ' ' || char === '\n') return char;
          
          // 文字ごとに異なる確率でランダム化
          // 波のような効果を作る
          const waveOffset = Math.sin((lineIndex * 3 + charIndex * 0.5 + Date.now() * 0.001)) * 0.5 + 0.5;
          const randomThreshold = progress * (0.7 + waveOffset * 0.3);
          
          if (Math.random() < randomThreshold) {
            // ランダムな文字に置き換え
            return randomChars[Math.floor(Math.random() * randomChars.length)];
          } else {
            // オリジナルの文字を維持
            return char;
          }
        }).join('');
      }).join('\n');
    };

    // 実際の結果への遷移アニメーション
    const transitionToReal = (targetText: string) => {
      isTransitioningToReal = true;
      const startTime = Date.now();
      const duration = 200; // 0.2秒
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1, elapsed / duration);
        
        if (progress >= 1) {
          setDisplayText(targetText);
          setIsTransitioning(false);
          return;
        }
        
        // プログレスに応じて、ランダムな文字から実際の文字へ変化
        const lines = targetText.split('\n');
        const result = lines.map(line => {
          if (!line) return line;
          
          return line.split('').map((char, index) => {
            const charProgress = progress + (Math.random() * 0.2 - 0.1); // ランダム性を追加
            
            if (charProgress > Math.random()) {
              return char; // 実際の文字
            } else {
              // まだランダムな文字
              const randomChars = isJapanese 
                ? 'あいうえおかきくけこさしすせそたちつてとなにぬねの'
                : 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
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
    if (suggestion.suggestion && !isTransitioningToReal) {
      if (isTransitioning) {
        // ランダムテキストアニメーション中なら遷移開始
        transitionToReal(suggestion.suggestion);
      } else {
        // まだアニメーションが始まっていない場合は即座に表示
        setDisplayText(suggestion.suggestion);
        setIsTransitioning(false);
      }
      return;
    }

    // 改善案がまだない場合、2秒後からランダムテキストアニメーション
    if (!suggestion.suggestion) {
      setDisplayText(suggestion.originalText);
      
      const startTimer = setTimeout(() => {
        setIsTransitioning(true);
        const animationStartTime = Date.now();
        
        // 徐々に変化していくアニメーション
        let frameCount = 0;
        const continuousAnimate = () => {
          if (suggestion.suggestion) {
            // AIの結果が来たら遷移開始
            transitionToReal(suggestion.suggestion);
            return;
          }
          
          frameCount++;
          // 12フレームに1回だけ更新（約60fps → 約5fps）
          if (frameCount % 12 === 0) {
            const elapsed = Date.now() - animationStartTime;
            const progress = Math.min(1, elapsed / 2000); // 2秒かけて完全にランダムに
            
            // プログレスに応じて部分的にランダム化
            const partiallyRandomText = generatePartialRandomText(suggestion.originalText, progress);
            setDisplayText(partiallyRandomText);
          }
          
          animationFrame = requestAnimationFrame(continuousAnimate);
        };
        
        continuousAnimate();
      }, 2000);

      return () => {
        clearTimeout(startTimer);
        if (animationFrame) {
          cancelAnimationFrame(animationFrame);
        }
        if (transitionTimer) {
          clearTimeout(transitionTimer);
        }
      };
    }

    return () => {
      if (animationFrame !== undefined) {
        cancelAnimationFrame(animationFrame);
      }
      if (transitionTimer !== undefined) {
        clearTimeout(transitionTimer);
      }
    };
  }, [suggestion.suggestion, suggestion.originalText, isJapanese]);

  // Handle escape key to close popup
  useEffect(() => {
    // const [showCopyFeedback, setShowCopyFeedback] = useState(false);  // ここから移動
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onDismiss();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onDismiss]);

  // Update the position of the popup based on the selection or caret position
  const updatePosition = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      // Set the position based on the caret's bounding rectangle
      position = {
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
      };
    }
  };

  // Handle input events to update the position dynamically
  useEffect(() => {
    const handleInput = () => {
      updatePosition();
    };

    document.addEventListener("input", handleInput);
    document.addEventListener("selectionchange", updatePosition);
    return () => {
      document.removeEventListener("input", handleInput);
      document.removeEventListener("selectionchange", updatePosition);
    };
  }, []);

  const labels = {
    // title: isJapanese ? "トーンチェック" : "Tone Check",
    title: isJapanese ? "改善提案" : "Improvement Suggestion",
    issues: isJapanese ? "問題点:" : "Issues:",
    suggestion: isJapanese ? "提案:" : "Suggestion:",
    why: isJapanese ? "理由:" : "Why:",
    improvementTitle: isJapanese ? "改善ポイント" : "Improvement Points",
    suggestionTitle: isJapanese ? "改善案" : "Suggestion",
    ignore: isJapanese ? "戻す" : "Back",
    accept: isJapanese ? "反映" : "Apply",
    copyToClipboard: isJapanese
      ? "クリップボードにコピー"
      : "Copy to Clipboard",
  };

  if (isEmbedded) {
    return (
      <div className="h-full overflow-auto bg-white rounded-lg">
        <div className="p-5 space-y-4">
          {/* ヘッダー with 💡 アイコン */}
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">
                {suggestion.hasIssues ? '💡' : '❤️'}
              </span>
              <h3 className="text-base font-bold text-slate-800">
                {suggestion.hasIssues 
                  ? labels.title 
                  : isJapanese ? "素敵なメッセージです" : "Great message!"}
              </h3>
            </div>
            <button
              onClick={onDismiss}
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

          {/* AI Receipt - 共感的な受け止め（背景色なし） */}
          <div className="text-sm text-slate-700 leading-relaxed min-h-[40px]">
            {(suggestion.ai_receipt || suggestion.reasoning) ? (
              suggestion.ai_receipt || suggestion.reasoning
            ) : (
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse w-full"></div>
              </div>
            )}
          </div>

          {/* 改善ポイント - 黄色背景 */}
          {suggestion.hasIssues ? (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-700">
                {labels.improvementTitle}
              </h4>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 min-h-[80px]">
                {suggestion.improvement_points ? (
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {suggestion.improvement_points}
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="h-4 bg-yellow-200 rounded animate-pulse w-3/4"></div>
                    <div className="h-4 bg-yellow-200 rounded animate-pulse w-full"></div>
                    <div className="h-4 bg-yellow-200 rounded animate-pulse w-5/6"></div>
                  </div>
                )}
                
                {/* 詳細分析のアコーディオン */}
                {suggestion.detailed_analysis && (
                  <div className="mt-3">
                    <button
                      onClick={async () => {
                        const newState = !showDetailedAnalysis;
                        setShowDetailedAnalysis(newState);
                        
                        // ログ記録
                        await log("detailed_analysis_toggled", {
                          action: newState ? "expand" : "collapse",
                          previousText: suggestion.originalText,
                          newText: suggestion.suggestion || undefined
                        });
                      }}
                      className="flex items-center gap-1 text-xs font-medium text-yellow-700 hover:text-yellow-800 transition-colors"
                    >
                      <span>{isJapanese ? "もっと詳しく学習する" : "Learn more"}</span>
                      {showDetailedAnalysis ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                    
                    {showDetailedAnalysis && (
                      <div className="mt-2 pt-2 border-t border-yellow-300">
                        <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                          {suggestion.detailed_analysis}
                        </p>
                      </div>
                    )}
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

          {/* 改善案またはメッセージ表示（共通UI） */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-700">
              {suggestion.hasIssues ? labels.suggestionTitle : (isJapanese ? "あなたのメッセージ" : "Your message")}
            </h4>
            
            {/* このまま送信OKバッジ（hasIssues:falseの場合のみ） */}
            {!suggestion.hasIssues && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                <p className="text-sm text-blue-800 font-medium flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {isJapanese ? "このまま送信OKです！" : "Ready to send!"}
                </p>
              </div>
            )}
            
            {/* 編集可能なテキストエリアとして表示（共通） */}
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="px-4 sm:px-5 py-2 sm:py-3 border-b border-purple-200 bg-purple-50">
                <h3 className="text-sm sm:text-base font-semibold text-purple-800 tracking-wide">
                  投稿予定のメッセージ（編集可能）
                </h3>
              </div>
              <textarea
                value={isShowingOriginal 
                  ? suggestion.originalText 
                  : (suggestion.hasIssues 
                    ? (isTransitioning ? displayText : (suggestion.suggestion || displayText || ''))
                    : suggestion.originalText)
                }
                onChange={(e) => {
                  if (onSuggestionEdit && !isShowingOriginal && !isTransitioning) {
                    onSuggestionEdit(e.target.value);
                  }
                }}
                disabled={suggestion.hasIssues ? (!suggestion.suggestion || isShowingOriginal || isTransitioning) : false}
                className={`w-full resize-none border-0 rounded-none focus:outline-none focus:ring-0 focus-visible:ring-0 text-xs sm:text-sm leading-relaxed h-40 p-4 disabled:bg-gray-50 disabled:text-gray-500 ${
                  isTransitioning ? 'transition-opacity duration-300' : ''
                }`}
                style={{ fontFamily: "Inter, sans-serif" }}
                placeholder="ここに改善案が表示されます。このエリアは、直接編集が可能です。"
              />
            </div>
          </div>

          {/* アクションボタン */}
          <div className="flex items-center justify-between pt-3">
            {/* 左側：トグルボタン */}
            <div>
              {suggestion.hasIssues && suggestion.suggestion && (
                <button
                  onClick={() => {
                    setIsShowingOriginal(!isShowingOriginal);
                  }}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
                >
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={isShowingOriginal 
                        ? "M9 5l7 7-7 7" // 右向き矢印（改善案へ）
                        : "M11 17l-5-5m0 0l5-5m-5 5h12" // 左向き矢印（オリジナルへ）
                      }
                    />
                  </svg>
                  {isShowingOriginal 
                    ? (isJapanese ? "SenpAI Senseiの改善案を反映させる" : "Apply SenpAI Sensei's suggestion")
                    : (isJapanese ? "オリジナルのドラフトに戻す" : "Revert to original")
                  }
                </button>
              )}
            </div>

            {/* 右側：コピーボタン */}
            <div className="flex items-center gap-3">
              {/* コピーボタン */}
              <button
                  onClick={async () => {
                    const textToCopy = isShowingOriginal 
                      ? suggestion.originalText 
                      : (suggestion.suggestion || suggestion.originalText);
                    
                    if (textToCopy) {
                      await navigator.clipboard.writeText(textToCopy);
                      setShowCopyFeedback(true);
                      setTimeout(() => setShowCopyFeedback(false), 2000);

                      await log("text_copied", {
                        action: "copy",
                        newText: textToCopy,
                      });
                    }
                  }}
                  disabled={suggestion.hasIssues ? (!suggestion.suggestion && !isShowingOriginal) : false}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors relative disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  {showCopyFeedback
                    ? isJapanese
                      ? "コピーしました！"
                      : "Copied!"
                    : labels.copyToClipboard}
                </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ポップアップ版は使用しない
  return null;
}
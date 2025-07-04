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
  onSuggestionEdit?: (text: string) => void;
  hasAcceptedSuggestion?: boolean;
  position: { top: number; left: number };
  isJapanese: boolean;
  isEmbedded?: boolean;
  hierarchy?: string;
  socialDistance?: string;
  onHierarchyChange?: (value: string) => void;
  onSocialDistanceChange?: (value: string) => void;
  onReanalyze?: () => void;
  externalChanges?: boolean;  // thread_contextや言語の変更フラグ
  analysisState?: 'ready' | 'analyzing' | 'analyzed';
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
  hierarchy = 'peer',
  socialDistance = 'neutral',
  onHierarchyChange,
  onSocialDistanceChange,
  onReanalyze,
  externalChanges = false,
}: ToneSuggestionProps) {
  // showCopyFeedback state をコンポーネントのトップレベルで定義
  const [showCopyFeedback, setShowCopyFeedback] = useState(false);
  const [showDetailedAnalysis, setShowDetailedAnalysis] = useState(false);
  const [isShowingOriginal, setIsShowingOriginal] = useState(false); // 追加：オリジナルを表示中かどうか
  const [displayText, setDisplayText] = useState<string>(''); // 表示用テキスト
  const [isTransitioning, setIsTransitioning] = useState(false); // テキスト変化中かどうか
  const [isAnalyzed, setIsAnalyzed] = useState(false); // 解析済みかどうか
  
  // 編集検知用のstate
  const [currentText, setCurrentText] = useState<string>('');
  const [hasTextChanged, setHasTextChanged] = useState(false);
  const [initialHierarchy, setInitialHierarchy] = useState(hierarchy);
  const [initialSocialDistance, setInitialSocialDistance] = useState(socialDistance);
  
  const { log } = useLogging(isJapanese ? "ja" : "en"); // log取得用

  // suggestionが更新されたら解析済み状態を更新
  useEffect(() => {
    if (suggestion.suggestion) {
      setIsAnalyzed(true);
      setCurrentText(suggestion.suggestion);
      setInitialHierarchy(hierarchy);
      setInitialSocialDistance(socialDistance);
      setHasTextChanged(false);
    }
  }, [suggestion.suggestion, hierarchy, socialDistance]);

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
    if (!currentText || !suggestion.suggestion) return false;
    const editDistance = getEditDistance(currentText, suggestion.suggestion);
    return editDistance > 5;
  };

  // 関係性が変更されたかどうか
  const hasRelationshipChanged = () => {
    return hierarchy !== initialHierarchy || socialDistance !== initialSocialDistance;
  };

  // 再解析が可能かどうか
  const canReanalyze = () => {
    if (!suggestion.suggestion || isTransitioning) return false;
    if (isShowingOriginal) return true; // オリジナル表示時は常に有効
    return hasTextChanged || hasRelationshipChanged() || externalChanges;
  };

  // テキスト編集時の処理
  const handleTextEdit = (newText: string) => {
    setCurrentText(newText);
    setHasTextChanged(hasSignificantChange());
    if (onSuggestionEdit) {
      onSuggestionEdit(newText);
    }
  };

  // 再解析時の処理
  const handleReanalyze = () => {
    if (onReanalyze && canReanalyze()) {
      setIsAnalyzed(false);
      onReanalyze();
    }
  };

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
        ? 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン会議資料確認共有関係者様連絡報告検討案件対応業務作業完了予定本日明日今週来週以降担当部署課長部長様方皆様御中ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?'
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
        ? 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン会議資料確認共有関係者様連絡報告検討案件対応業務作業完了予定本日明日今週来週以降担当部署課長部長様方皆様御中ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        : 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?αβγδεζηθικλμνξοπρστυφχψω';
      
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
        if (animationFrame !== undefined) {
          cancelAnimationFrame(animationFrame);
        }
        if (transitionTimer !== undefined) {
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
              
              {/* RelationshipSelector */}
              <div className="bg-purple-50 rounded-t-none rounded-b-lg px-4 py-2.5 mb-4">
                <div className="flex flex-col sm:flex-row sm:items-stretch gap-2.5 sm:gap-6">
                  {/* 宛先セクション */}
                  <div className="flex-1 flex flex-col sm:flex-col">
                    <div className="flex flex-row sm:flex-col items-center sm:items-stretch gap-2 sm:gap-1">
                      <p className="text-[11px] font-semibold text-purple-800 whitespace-nowrap sm:mb-0 px-1.5 sm:px-0">
                        {isJapanese ? '宛先' : 'To'}
                      </p>
                      <div className="flex space-x-1.5 flex-1 w-full">
                        {(isJapanese
                          ? [
                              { value: 'junior', label: '後輩・部下' },
                              { value: 'peer', label: '同僚・対等' },
                              { value: 'senior', label: '目上のかた' }
                            ]
                          : [
                              { value: 'junior', label: 'Junior' },
                              { value: 'peer', label: 'Peer' },
                              { value: 'senior', label: 'Senior' }
                            ]
                        ).map((option) => (
                          <button
                            key={option.value}
                            onClick={() => onHierarchyChange?.(option.value)}
                            disabled={!suggestion.suggestion || isTransitioning}
                            className={`flex-1 py-1.5 px-2 rounded-lg transition-all duration-200 min-h-[32px] sm:min-h-[36px] sm:h-[36px] ${
                              hierarchy === option.value
                                ? 'bg-purple-600 text-white shadow-sm'
                                : 'bg-white text-purple-700 hover:bg-purple-100 shadow-sm border border-purple-200'
                            } ${(!suggestion.suggestion || isTransitioning) ? 'opacity-60 cursor-not-allowed' : ''}`}
                          >
                            <p className="text-[10px] sm:text-xs font-semibold">
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
                    <div className="flex flex-row sm:flex-col items-center sm:items-stretch gap-2 sm:gap-1">
                      <p className="text-[11px] font-semibold text-purple-800 whitespace-nowrap sm:mb-0 px-1.5 sm:px-0">
                        {isJapanese ? '距離' : 'Distance'}
                      </p>
                      <div className="flex space-x-1.5 flex-1 w-full">
                        {(isJapanese
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
                            ]
                        ).map((option) => (
                          <button
                            key={option.value}
                            onClick={() => onSocialDistanceChange?.(option.value)}
                            disabled={!suggestion.suggestion || isTransitioning}
                            className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all duration-200 flex flex-col justify-center min-h-[32px] sm:min-h-[36px] sm:h-[36px] ${
                              socialDistance === option.value
                                ? 'bg-purple-600 text-white shadow-sm'
                                : 'bg-white text-purple-700 hover:bg-purple-100 shadow-sm border border-purple-200'
                            } ${(!suggestion.suggestion || isTransitioning) ? 'opacity-60 cursor-not-allowed' : ''}`}
                          >
                            <span className="block">{option.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* テキストエリア */}
              <div className="relative flex-1 flex flex-col min-h-0">
                <textarea
                  value={isShowingOriginal 
                    ? suggestion.originalText 
                    : (suggestion.hasIssues 
                      ? (isTransitioning ? displayText : (currentText || displayText || ''))
                      : suggestion.originalText)
                  }
                  onChange={(e) => {
                    if (!isShowingOriginal && !isTransitioning) {
                      handleTextEdit(e.target.value);
                    }
                  }}
                  disabled={suggestion.hasIssues ? (!suggestion.suggestion || isShowingOriginal || isTransitioning) : false}
                  className={`flex-1 resize-none border-0 rounded-none focus:outline-none focus:ring-0 focus-visible:ring-0 text-xs sm:text-sm leading-relaxed h-40 pb-12 px-4 disabled:bg-gray-50 disabled:text-gray-500 ${
                    isTransitioning ? 'transition-opacity duration-300' : ''
                  }`}
                  style={{ fontFamily: "Inter, sans-serif" }}
                  placeholder="ここに改善案が表示されます。このエリアは、直接編集が可能です。"
                />
                
                {/* 送信ボタン */}
                <div className="absolute bottom-2 right-4">
                  <button
                    onClick={handleReanalyze}
                    disabled={!canReanalyze()}
                    className={`p-2 rounded-md transition-all duration-200 ${
                      canReanalyze()
                        ? isAnalyzed && !hasTextChanged && !hasRelationshipChanged() && !externalChanges && !isShowingOriginal
                          ? 'bg-gray-300 hover:bg-gray-400 text-gray-600 shadow-sm'  // 解析済み
                          : 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm hover:shadow-md'  // 解析可能
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'  // 無効
                    }`}
                    title={
                      !suggestion.suggestion 
                        ? isJapanese ? "解析中..." : "Analyzing..."
                        : isAnalyzed && !hasTextChanged && !hasRelationshipChanged() && !externalChanges && !isShowingOriginal
                          ? isJapanese ? "解析済み" : "Already analyzed"
                          : isJapanese ? "メッセージを解析" : "Analyze message"
                    }
                  >
                    {isTransitioning ? (
                      <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg 
                        className={`w-5 h-5 ${
                          isAnalyzed && !hasTextChanged && !hasRelationshipChanged() && !externalChanges && !isShowingOriginal
                            ? 'rotate-0'  // 解析済み
                            : 'rotate-90'  // 解析可能
                        }`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        {isAnalyzed && !hasTextChanged && !hasRelationshipChanged() && !externalChanges && !isShowingOriginal ? (
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
                    : (currentText || suggestion.suggestion || suggestion.originalText);
                  
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
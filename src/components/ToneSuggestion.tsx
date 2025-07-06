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
  detailed_analysis?: string;
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
  externalChanges?: boolean;
  analysisState?: 'ready' | 'analyzing' | 'analyzed';
  animationPhase?: 'input' | 'transitioning' | 'suggestion';
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
  analysisState = 'ready',
  animationPhase = 'suggestion',
}: ToneSuggestionProps) {
  const [showCopyFeedback, setShowCopyFeedback] = useState(false);
  const [showDetailedAnalysis, setShowDetailedAnalysis] = useState(false);
  const [isShowingOriginal, setIsShowingOriginal] = useState(false);
  const [displayText, setDisplayText] = useState<string>('');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isAnalyzed, setIsAnalyzed] = useState(false);
  
  const [currentText, setCurrentText] = useState<string>('');
  const [hasTextChanged, setHasTextChanged] = useState(false);
  const [initialHierarchy, setInitialHierarchy] = useState(hierarchy);
  const [initialSocialDistance, setInitialSocialDistance] = useState(socialDistance);
  
  const { log } = useLogging(isJapanese ? "ja" : "en");

  useEffect(() => {
    if (suggestion.suggestion) {
      setIsAnalyzed(true);
      setCurrentText(suggestion.suggestion);
      setInitialHierarchy(hierarchy);
      setInitialSocialDistance(socialDistance);
      setHasTextChanged(false);
    }
  }, [suggestion.suggestion, hierarchy, socialDistance]);

  const getEditDistance = (str1: string, str2: string): number => {
    const lengthDiff = Math.abs(str1.length - str2.length);
    const commonLength = Math.min(str1.length, str2.length);
    let differences = 0;
    
    for (let i = 0; i < commonLength; i++) {
      if (str1[i] !== str2[i]) differences++;
    }
    
    return lengthDiff + differences;
  };

  const hasSignificantChange = () => {
    if (!currentText || !suggestion.suggestion) return false;
    const editDistance = getEditDistance(currentText, suggestion.suggestion);
    return editDistance > 5;
  };

  const hasRelationshipChanged = () => {
    return hierarchy !== initialHierarchy || socialDistance !== initialSocialDistance;
  };

  const canReanalyze = () => {
    if (!suggestion.suggestion || isTransitioning) return false;
    if (isShowingOriginal) return true;
    return hasTextChanged || hasRelationshipChanged() || externalChanges;
  };

  const handleTextEdit = (newText: string) => {
    setCurrentText(newText);
    setHasTextChanged(hasSignificantChange());
    if (onSuggestionEdit) {
      onSuggestionEdit(newText);
    }
  };

  const handleReanalyze = () => {
    if (onReanalyze && canReanalyze()) {
      setIsAnalyzed(false);
      onReanalyze();
    }
  };

  useEffect(() => {
    if (!suggestion.originalText) {
      setDisplayText('');
      return;
    }

    let animationFrame: number | undefined;
    let transitionTimer: NodeJS.Timeout | undefined;
    let isTransitioningToReal = false;

    const generateRandomText = (baseText: string): string => {
      const lines = baseText.split('\n');
      const randomChars = isJapanese 
        ? 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン会議資料確認共有関係者様連絡報告検討案件対応業務作業完了予定本日明日今週来週以降担当部署課長部長様方皆様御中ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?'
        : 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?αβγδεζηθικλμνξοπρστυφχψωÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ';
      
      return lines.map(line => {
        if (!line) return line;
        
        return line.split('').map(char => {
          if (char === ' ' || char === '\n') return char;
          return randomChars[Math.floor(Math.random() * randomChars.length)];
        }).join('');
      }).join('\n');
    };

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

    const transitionToReal = (targetText: string) => {
      isTransitioningToReal = true;
      const startTime = Date.now();
      const duration = 200;
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1, elapsed / duration);
        
        if (progress >= 1) {
          setDisplayText(targetText);
          setIsTransitioning(false);
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

    if (suggestion.suggestion && !isTransitioningToReal) {
      if (isTransitioning) {
        transitionToReal(suggestion.suggestion);
      } else {
        setDisplayText(suggestion.suggestion);
        setIsTransitioning(false);
      }
      return;
    }

    if (!suggestion.suggestion) {
      setDisplayText(suggestion.originalText);
      
      const startTimer = setTimeout(() => {
        setIsTransitioning(true);
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

  const labels = {
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

          <div className={`text-sm text-slate-700 leading-relaxed min-h-[40px] transition-all duration-500 ${
            animationPhase === 'suggestion' ? 'opacity-100' : 'opacity-0'
          }`} style={{ transitionDelay: animationPhase === 'suggestion' ? '200ms' : '0ms' }}>
            {(suggestion.ai_receipt || suggestion.reasoning) ? (
              suggestion.ai_receipt || suggestion.reasoning
            ) : (
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse w-full"></div>
              </div>
            )}
          </div>

          {suggestion.hasIssues ? (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-700">
                {labels.improvementTitle}
              </h4>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 min-h-[80px] relative">
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
                
                {suggestion.detailed_analysis && (
                  <div className="mt-3">
                    <button
                      onClick={async () => {
                        const newState = !showDetailedAnalysis;
                        setShowDetailedAnalysis(newState);
                        
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

          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-700">
              {suggestion.hasIssues ? labels.suggestionTitle : (isJapanese ? "あなたのメッセージ" : "Your message")}
            </h4>
            
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
          </div>

          <div className="flex items-center justify-between pt-3">
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
                        ? "M9 5l7 7-7 7"
                        : "M11 17l-5-5m0 0l5-5m-5 5h12"
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

            <div className="flex items-center gap-3">
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

  return null;
}
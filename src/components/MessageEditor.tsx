"use client";

import { useRef, useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";

interface MessageEditorProps {
  mode: 'input' | 'suggestion';
  text: string;
  onTextChange: (text: string) => void;
  hierarchy: string;
  socialDistance: string;
  onHierarchyChange: (value: string) => void;
  onSocialDistanceChange: (value: string) => void;
  onAnalyze: () => void;
  analysisState: 'ready' | 'analyzing' | 'analyzed';
  canAnalyze: boolean;
  isEditable?: boolean;
  isTransitioning?: boolean;
  title?: string;
  placeholder?: string;
  isJapanese: boolean;
  hasAcceptedSuggestion?: boolean;
  hasSignificantChange?: boolean;
  externalChanges?: boolean;
  // 解析履歴
  analysisHistory?: Array<{
    timestamp: Date;
    original: string;
    suggestion: string;
    settings: { hierarchy: string; socialDistance: string; };
  }>;
  onHistorySelect?: (index: number) => void;
  // トグル機能用の新規追加
  originalText?: string;
  suggestionText?: string;
  isShowingOriginal?: boolean;
  onToggleOriginal?: () => void;
  hasEditedOriginal?: boolean;
}

export function MessageEditor({
  mode,
  text,
  onTextChange,
  hierarchy,
  socialDistance,
  onHierarchyChange,
  onSocialDistanceChange,
  onAnalyze,
  analysisState,
  canAnalyze,
  isEditable = true,
  isTransitioning = false,
  title,
  placeholder,
  isJapanese,
  hasAcceptedSuggestion = false,
  hasSignificantChange = true,
  externalChanges = false,
  analysisHistory = [],
  onHistorySelect,
  originalText,
  suggestionText,
  isShowingOriginal = false,
  onToggleOriginal,
  hasEditedOriginal = false,
}: MessageEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [hasTextChanged, setHasTextChanged] = useState(false);
  const [initialText, setInitialText] = useState(text);

// テキスト変更の検知
  useEffect(() => {
    if (mode === 'suggestion' && analysisState === 'analyzed') {
      setInitialText(text);
      setHasTextChanged(false);
    }
  }, [mode, analysisState, text]);

  // テキストエリアの初期高さ設定と変更時の自動調整
  useEffect(() => {
    if (textareaRef.current && typeof window !== 'undefined') {
      // モバイルデバイスでは固定高さを維持
      const isMobile = window.innerWidth < 640;
      if (isMobile) {
        textareaRef.current.style.height = '150px';
        textareaRef.current.style.minHeight = '150px';
      } else {
        // デスクトップでは自動調整
        textareaRef.current.style.height = 'auto';
        const newHeight = Math.min(textareaRef.current.scrollHeight, 400);
        textareaRef.current.style.height = `${newHeight}px`;
      }
    }
  }, [text, mode]); // textまたはmodeが変更されたら再計算


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
    return subtextMap[socialDistance] || '';
  };

  const labels = {
    writeTitle: isJapanese ? "投稿予定のメッセージを書く" : "Write your message",
    suggestionTitle: isJapanese ? "SenpAI Senseiのメッセージ案（編集可能）" : "SenpAI Sensei's suggestion (editable)",
    writePlaceholder: isJapanese
      ? "ここに、これから相手に送ろうとしているメッセージを入力してください。　入力後、右下の送信/解析ボタンをクリックしてください。"
      : "Start typing your message here... Click the analyze button when ready.",
    suggestionPlaceholder: isJapanese
      ? "ここに改善案が表示されます。このエリアは、直接編集が可能です。"
      : "Suggestions will appear here. This area is directly editable.",
    analyzing: isJapanese ? "分析中......" : "Analyzing...",
    to: isJapanese ? '宛先' : 'To',
    distance: isJapanese ? '距離' : 'Distance',
  };

  const hierarchyOptions = isJapanese
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

  const distanceOptions = isJapanese
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

  // 解析可能かどうかの判定
  const shouldEnableAnalyze = () => {
    if (mode === 'input') {
      return canAnalyze && (!hasAcceptedSuggestion || hasSignificantChange);
    } else {
      // suggestion mode
      const textChanged = text !== initialText && Math.abs(text.length - initialText.length) > 5;
      return canAnalyze && (textChanged || externalChanges);
    }
  };

return (
    <div className={`bg-white shadow-lg border border-slate-200 hover:shadow-xl transition-shadow duration-300 ${mode === 'suggestion' ? '' : 'rounded-xl overflow-hidden'}`}>
      {/* Header */}
      <div className="px-4 py-2 sm:py-3 border-b border-purple-200 bg-purple-50">
        <div className="flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-semibold text-purple-800 tracking-wide">
            {title || (mode === 'input' ? labels.writeTitle : labels.suggestionTitle)}
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
            {/* 解析履歴 */}
            {analysisHistory.length > 0 && onHistorySelect && (
              <div className="relative group">
                <button className="text-xs text-purple-600 hover:text-purple-800">
                  {isJapanese ? "履歴" : "History"} ({analysisHistory.length})
                </button>
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-slate-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                  <div className="p-2 max-h-48 overflow-y-auto">
                    {analysisHistory.map((item, index) => (
                      <button
                        key={index}
                        onClick={() => onHistorySelect(index)}
                        className="block w-full text-left p-2 hover:bg-purple-50 rounded text-xs"
                      >
                        <div className="font-medium text-slate-700">
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </div>
                        <div className="text-slate-500 truncate">
                          {item.original.substring(0, 30)}...
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 関係性セレクター */}
      <div className="bg-purple-50 px-4 py-2.5">
        <div className="flex flex-col sm:flex-row sm:items-stretch gap-2.5 sm:gap-6">
          {/* 宛先セクション */}
          <div className="flex-1 flex flex-col sm:flex-col">
            <div className="flex flex-row sm:flex-col items-center sm:items-stretch gap-2 sm:gap-1">
              <p className="text-[11px] font-semibold text-purple-800 whitespace-nowrap sm:mb-0 min-w-[32px]">
                {labels.to}
              </p>
              <div className="flex space-x-1.5 flex-1 w-full">
                {hierarchyOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => onHierarchyChange(option.value)}
                    disabled={isTransitioning}
                    className={`group relative flex-1 py-1.5 px-2 rounded-lg transition-all duration-200 min-h-[32px] sm:min-h-[36px] sm:h-[36px] ${
                      hierarchy === option.value
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'bg-white text-purple-700 hover:bg-purple-100 shadow-sm border border-purple-200'
                    } ${isTransitioning ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    {/* ホバー時の背景アニメーション */}
                    <div className="absolute inset-0 bg-purple-100 rounded-lg opacity-0 group-hover:opacity-50 transition-opacity duration-200" />
                    <p className="relative text-[10px] sm:text-xs font-semibold">
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
              <p className="text-[11px] font-semibold text-purple-800 whitespace-nowrap sm:mb-0 min-w-[32px]">
                {labels.distance}
              </p>
              <div className="flex space-x-1.5 flex-1 w-full">
                {distanceOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => onSocialDistanceChange(option.value)}
                    disabled={isTransitioning}
                    className={`group relative flex-1 py-1 px-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition-all duration-200 flex flex-col justify-center min-h-[32px] sm:min-h-[36px] sm:h-[36px] ${
                      socialDistance === option.value
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'bg-white text-purple-700 hover:bg-purple-100 shadow-sm border border-purple-200'
                    } ${isTransitioning ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    {/* ホバー時の背景アニメーション */}
                    <div className="absolute inset-0 bg-purple-100 rounded-lg opacity-0 group-hover:opacity-50 transition-opacity duration-200" />
                    <span className="relative block sm:font-semibold">{option.label}</span>
                    {socialDistance === option.value && (
                      <span className="relative hidden sm:block text-[8px] opacity-80 -mt-0.5 whitespace-nowrap">
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

      {/* Text Area */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            if (isEditable && !isTransitioning) {
              onTextChange(e.target.value);
              setHasTextChanged(true);
            }
          }}
          placeholder={mode === 'input' ? labels.writePlaceholder : labels.suggestionPlaceholder}
          disabled={!isEditable || isTransitioning}
          className={`w-full resize-y border-0 rounded-none focus:outline-none focus:ring-0 focus-visible:ring-0 text-xs sm:text-sm leading-relaxed px-4 pt-3 pb-12 transition-all duration-300 ${
            isTransitioning ? 'opacity-80' : ''
          } ${!isEditable ? 'bg-gray-50 text-gray-500' : 'bg-white text-gray-900'}`}
          rows={5}
          style={{ 
            fontFamily: "Inter, sans-serif",
            minHeight: "120px",
            maxHeight: "70vh"
          }}
        />

        {/* ボタンエリア */}
        <div className="absolute bottom-2 left-4 right-4 z-10 flex items-center justify-between">
          {/* 左側：トグルボタン */}
          <div>
            {mode === 'suggestion' && onToggleOriginal && (
              <>
                {!isShowingOriginal && suggestionText && (
                  <button
                    onClick={onToggleOriginal}
                    className="text-sm text-purple-600 hover:text-purple-800 transition-colors"
                  >
                    ← {isJapanese ? "オリジナルに戻す" : "Show original"}
                  </button>
                )}
                {isShowingOriginal && (
                  <button
                    onClick={onToggleOriginal}
                    className="text-sm text-purple-600 hover:text-purple-800 transition-colors"
                  >
                    {hasEditedOriginal 
                      ? (isJapanese ? "← 編集中の文章に戻す" : "← Back to edited")
                      : (isJapanese ? "提案を見る →" : "Show suggestion →")}
                  </button>
                )}
              </>
            )}
          </div>

          {/* 右側：既存のボタン */}
          <div className="flex items-center gap-2">
            {/* コピーボタン（suggestion modeの時は常に表示） */}
            {mode === 'suggestion' && (
              <button
                onClick={async () => {
                  if (text) {
                    await navigator.clipboard.writeText(text);
                    // TODO: コピー完了のフィードバック
                  }
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-md bg-gray-500 hover:bg-gray-600 text-white text-sm shadow-sm hover:shadow-md transition-all duration-200"
              >
                <span className="text-xs sm:text-sm">
                  {isJapanese ? "クリップボードにコピー" : "Copy to clipboard"}
                </span>
                <svg 
                  className="w-4 h-4"
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
              </button>
            )}

            {/* 送信/解析ボタン */}
            <button
              onClick={onAnalyze}
              disabled={!shouldEnableAnalyze()}
              className={`p-2 rounded-md transition-all duration-200 ${
                shouldEnableAnalyze()
                  ? analysisState === 'analyzed' && !hasTextChanged && !externalChanges
                    ? 'bg-green-500 hover:bg-green-600 text-white shadow-sm'
                    : `bg-purple-600 hover:bg-purple-700 text-white shadow-sm hover:shadow-md
                       ${text.length > 50 && analysisState === 'ready' && mode === 'input' ? 'pulse-animation' : ''}`
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
              title={
                !canAnalyze
                  ? isJapanese 
                    ? `もう少しテキストを入力してください` 
                    : `Please enter more text`
                  : hasAcceptedSuggestion && !hasSignificantChange && mode === 'input'
                    ? isJapanese ? "変更が少ないため再解析不要" : "No significant changes to analyze"
                    : analysisState === 'analyzed' && !hasTextChanged && !externalChanges
                      ? isJapanese ? "解析済み" : "Already analyzed"
                      : isJapanese ? "メッセージを解析 (Ctrl+Enter)" : "Analyze message (Ctrl+Enter)"
              }
            >
              {analysisState === 'analyzing' ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg 
                  className={`w-5 h-5 transform transition-transform duration-200 ${
                    shouldEnableAnalyze()
                      ? analysisState === 'analyzed' && !hasTextChanged && !externalChanges
                        ? 'rotate-0'
                        : 'rotate-90'
                      : 'rotate-45'
                  }`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  {analysisState === 'analyzed' && shouldEnableAnalyze() && !hasTextChanged && !externalChanges ? (
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M5 13l4 4L19 7" 
                    />
                  ) : (
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
  );
}
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
  hasAcceptedSuggestion = false,
  position,
  isJapanese,
  isEmbedded = false,
}: ToneSuggestionProps) {
  // showCopyFeedback state をコンポーネントのトップレベルで定義
  const [showCopyFeedback, setShowCopyFeedback] = useState(false);
  const [showDetailedAnalysis, setShowDetailedAnalysis] = useState(false);
  const { log } = useLogging(isJapanese ? "ja" : "en"); // log取得用

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
                  : isJapanese ? "素敵な文章です" : "Great message!"}
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
          {/* バックエンドが対応するまでは reasoning を代用表示 */}
          {(suggestion.ai_receipt || suggestion.reasoning) && (
            <div className="text-sm text-slate-700 leading-relaxed">
              {suggestion.ai_receipt || suggestion.reasoning}
            </div>
          )}

          {/* 旧: Issues セクション（コメントアウト） */}
          {/* {suggestion.issues.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <h4 className="text-sm font-semibold text-red-700 mb-2 flex items-center">
                <svg
                  className="w-4 h-4 mr-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                {labels.issues}
              </h4>
              <ul className="space-y-1">
                {suggestion.issues.slice(0, 3).map((issue, index) => (
                  <li
                    key={index}
                    className="text-sm text-red-600 leading-relaxed pl-2"
                  >
                    • {issue}
                  </li>
                ))}
              </ul>
            </div>
          )} */}

          {/* 改善ポイント - 黄色背景 */}
          {suggestion.hasIssues ? (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-700">
                {labels.improvementTitle}
              </h4>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-slate-700 leading-relaxed">
                  {suggestion.improvement_points}
                </p>
                
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

          {/* 旧: Suggested improvement セクション（コメントアウト） */}
          {/* <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <h4 className="text-sm font-semibold text-emerald-700 mb-2 flex items-center">
              <svg
                className="w-4 h-4 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              {labels.suggestion}
            </h4>
            <div className="bg-white rounded-lg p-3 border border-emerald-300/50 shadow-sm">
              <p className="text-slate-800 text-sm leading-relaxed font-medium">
                "{suggestion.suggestion}"
              </p>
            </div>
          </div> */}

          {/* 改善案またはOKメッセージ */}
          {suggestion.hasIssues && suggestion.suggestion ? (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-700">
                {labels.suggestionTitle}
              </h4>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {suggestion.suggestion}
                </p>
              </div>
            </div>
          ) : !suggestion.hasIssues && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-blue-800 font-medium">
                  {isJapanese ? "このまま送信OKです！" : "Ready to send!"}
                </p>
                <button
                  onClick={async () => {
                    if (suggestion.originalText) {
                      await navigator.clipboard.writeText(suggestion.originalText);
                      setShowCopyFeedback(true);
                      setTimeout(() => setShowCopyFeedback(false), 2000);

                      await log("text_copied", {
                        action: "copy",
                        newText: suggestion.originalText,
                      });
                    }
                  }}
                  className="ml-3 inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-700 bg-white hover:bg-blue-50 border border-blue-300 rounded-md transition-colors"
                >
                  <svg
                    className="w-3.5 h-3.5 mr-1.5"
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
          )}

          {/* 旧: Reasoning セクション（コメントアウト） */}
          {/* {suggestion.reasoning && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800 leading-relaxed">
                <span className="font-semibold text-blue-900">
                  {labels.why}
                </span>{" "}
                {suggestion.reasoning}
              </p>
            </div>
          )} */}

          {/* 旧: Actions（コメントアウト） */}
          {/* <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              onClick={onDismiss}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg transition-all duration-200 hover:bg-white hover:shadow-sm"
            >
              {labels.ignore}
            </button>
            <button
              onClick={onAccept}
              className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
            >
              {labels.accept}
            </button>
          </div> */}

          {/* アクションボタン */}
          <div className="flex items-center justify-start space-x-3 pt-3">
            {/* hasIssuesがtrueで、suggestionがある場合のみ「反映」ボタンを表示 */}
            {suggestion.hasIssues && suggestion.suggestion && !hasAcceptedSuggestion && (
              <button
                onClick={onAccept}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm"
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
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {labels.accept}
              </button>
            )}

            {/* hasIssuesがtrueで、suggestionがある場合のみコピーボタンを表示 */}
            {suggestion.hasIssues && suggestion.suggestion && (
              <button
                onClick={async () => {
                  if (suggestion.suggestion) {
                    await navigator.clipboard.writeText(suggestion.suggestion);
                    setShowCopyFeedback(true);
                    setTimeout(() => setShowCopyFeedback(false), 2000);

                    await log("text_copied", {
                      action: "copy",
                      newText: suggestion.suggestion,
                    });
                  }
                }}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-slate-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors relative"
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
            )}

            {/* 戻すボタン */}
            {hasAcceptedSuggestion && onRevert && (
              <button
                onClick={onRevert}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 rounded-lg transition-colors"
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
                    d="M11 17l-5-5m0 0l5-5m-5 5h12"
                  />
                </svg>
                {labels.ignore}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ポップアップ版は使用しない
  return null;
}
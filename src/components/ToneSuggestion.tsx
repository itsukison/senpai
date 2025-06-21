"use client";

import { useEffect } from "react";

interface ToneAnalysis {
  hasIssues: boolean;
  originalText: string;
  suggestion: string | null;
  issues: string[];
  reasoning: string;
}

interface ToneSuggestionProps {
  suggestion: ToneAnalysis;
  onAccept: () => void;
  onDismiss: () => void;
  position: { top: number; left: number };
  isJapanese: boolean;
  isEmbedded?: boolean;
}

export function ToneSuggestion({
  suggestion,
  onAccept,
  onDismiss,
  position,
  isJapanese,
  isEmbedded = false,
}: ToneSuggestionProps) {
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
    title: isJapanese ? "トーンチェック" : "Tone Check",
    issues: isJapanese ? "問題点:" : "Issues:",
    suggestion: isJapanese ? "提案:" : "Suggestion:",
    why: isJapanese ? "理由:" : "Why:",
    ignore: isJapanese ? "無視" : "Ignore",
    accept: isJapanese ? "承認" : "Accept",
  };

  if (isEmbedded) {
    return (
      <div className="h-full overflow-auto bg-slate-50 rounded-lg border border-slate-200">
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 bg-amber-500 rounded-full shadow-sm ring-2 ring-amber-100"></div>
              <h3 className="text-slack-darkgray font-bold text-sm tracking-wide">
                {labels.title}
              </h3>
            </div>
            <button
              onClick={onDismiss}
              className="text-slate-400 hover:text-slate-600 transition-all duration-200 p-1.5 rounded-lg hover:bg-white/60 backdrop-blur-sm"
            >
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Issues */}
          {suggestion.issues.length > 0 && (
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
          )}

          {/* Suggested improvement - enhanced version */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
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
          </div>

          {/* Reasoning */}
          {suggestion.reasoning && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800 leading-relaxed">
                <span className="font-semibold text-blue-900">
                  {labels.why}
                </span>{" "}
                {suggestion.reasoning}
              </p>
            </div>
          )}

          {/* Actions - enhanced */}
          <div className="flex items-center justify-end space-x-3 pt-2">
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
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed z-50"
      style={{
        bottom: "20px",
        right: "20px",
        width: "320px",
      }}
    >
      <div className="bg-slack-white rounded-lg shadow-slack-lg border border-slack-border modal-appear">
        <div className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
              <h3 className="text-slack-darkgray font-semibold text-sm">
                {labels.title}
              </h3>
            </div>
            <button
              onClick={onDismiss}
              className="text-slack-gray hover:text-slack-darkgray transition-colors p-1 rounded hover:bg-slack-lightgray"
            >
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Why this message needs improvement */}
          <div className="mb-3">
            <h4 className="text-sm font-medium text-slack-red mb-2 flex items-center">
              <svg
                className="w-4 h-4 mr-1"
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
              {suggestion.issues.map((issue, index) => (
                <li
                  key={index}
                  className="text-xs text-slack-gray leading-relaxed pl-1"
                >
                  • {issue}
                </li>
              ))}
            </ul>
          </div>

          {/* Suggested improvement */}
          <div className="mb-3">
            <h4 className="text-sm font-medium text-slack-green mb-2 flex items-center">
              <svg
                className="w-4 h-4 mr-1"
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
            <div className="bg-slack-lightgray rounded-lg p-3 border border-slack-green/30">
              <p className="text-slack-darkgray text-sm leading-relaxed">
                "{suggestion.suggestion}"
              </p>
            </div>
          </div>

          {/* Brief reasoning */}
          {suggestion.reasoning && (
            <div className="mb-3">
              <p className="text-xs text-slack-gray leading-relaxed">
                <span className="font-medium text-slack-darkgray">
                  {labels.why}
                </span>{" "}
                {suggestion.reasoning}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end space-x-2 mt-4">
            <button
              onClick={onDismiss}
              className="px-3 py-1.5 text-xs text-slack-gray hover:text-slack-darkgray border border-slack-border rounded-md transition-colors hover:bg-slack-lightgray"
            >
              {labels.ignore}
            </button>
            <button
              onClick={onAccept}
              className="px-4 py-1.5 text-xs font-medium text-white bg-slack-green hover:bg-green-600 rounded-md transition-colors"
            >
              {labels.accept}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

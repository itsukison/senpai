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
}

export function ToneSuggestion({
  suggestion,
  onAccept,
  onDismiss,
  position,
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
    if (selection.rangeCount > 0) {
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

  return (
    <div
      className="fixed"
      style={{
        bottom: "20px",
        right: "20px",
        width: "300px",
      }}
    >
      <div className="bg-spotify-darkgray rounded-xl shadow-spotify-lg border border-gray-700 modal-appear">
        <div className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
              <h3 className="text-spotify-white font-semibold text-sm">
                Tone Check
              </h3>
            </div>
            <button
              onClick={onDismiss}
              className="text-spotify-gray hover:text-spotify-white transition-colors p-1"
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
            <h4 className="text-sm font-medium text-red-400 mb-2 flex items-center">
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
              Issues:
            </h4>
            <ul className="space-y-1">
              {suggestion.issues.map((issue, index) => (
                <li
                  key={index}
                  className="text-xs text-spotify-gray leading-relaxed pl-1"
                >
                  • {issue}
                </li>
              ))}
            </ul>
          </div>

          {/* Suggested improvement */}
          <div className="mb-3">
            <h4 className="text-sm font-medium text-spotify-green mb-2 flex items-center">
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
              Suggestion:
            </h4>
            <div className="bg-spotify-lightgray rounded-lg p-3 border border-spotify-green/30">
              <p className="text-spotify-white text-sm leading-relaxed">
                "{suggestion.suggestion}"
              </p>
            </div>
          </div>

          {/* Brief reasoning */}
          {suggestion.reasoning && (
            <div className="mb-3">
              <p className="text-xs text-spotify-gray leading-relaxed">
                <span className="font-medium text-spotify-white">Why:</span>{" "}
                {suggestion.reasoning}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end space-x-2 mt-4">
            <button
              onClick={onDismiss}
              className="px-3 py-1.5 text-xs text-spotify-gray hover:text-spotify-white border border-gray-700 rounded-md transition-colors"
            >
              Ignore
            </button>
            <button
              onClick={onAccept}
              className="px-4 py-1.5 text-xs font-medium text-spotify-black bg-spotify-green hover:bg-green-400 rounded-md transition-colors"
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

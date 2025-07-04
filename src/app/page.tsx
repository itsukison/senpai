"use client";

import { useState, useRef, useEffect } from "react";
import { ToneChecker } from "@/components/ToneChecker";

export default function Home() {
  const [isJapanese, setIsJapanese] = useState(true);

  const toggleLanguage = () => {
    setIsJapanese(!isJapanese);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Navigation Bar */}
      <nav className="bg-white border-b border-slate-200 shadow-sm backdrop-blur-md flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
                SenpAI<span className="text-purple-800"> Sensei</span>
              </div>
              <div className="hidden sm:block text-xs sm:text-sm text-slate-600 font-medium">
                {isJapanese
                  ? "職場チャットをAIが改善。「チームが動く」プロフェッショナルな表現へ。"
                  : "AI-enhanced workplace messaging. Professional communication that moves teams forward."}
              </div>
            </div>

            {/* Language Toggle */}
            <div className="flex items-center space-x-2">
              <span
                className={`text-sm font-medium ${
                  !isJapanese ? "text-purple-800" : "text-slate-500"
                }`}
              >
                EN
              </span>
              <button
                onClick={toggleLanguage}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 shadow-sm ${
                  isJapanese ? "bg-purple-800" : "bg-slate-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 shadow-sm ${
                    isJapanese ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <span
                className={`text-sm font-medium ${
                  isJapanese ? "text-purple-800" : "text-slate-500"
                }`}
              >
                日本語
              </span>
            </div>
          </div>
        </div>
      </nav>
      {/* Title and Description セクションを完全に削除 */}
      {/* Main Content - Flex container that takes remaining space */}
      <div className="flex-1 flex flex-col max-w-7xl mx-auto w-full px-3 sm:px-5 lg:px-8 py-4 sm:py-6 bg-white mb-4 min-h-0 mt-4">
        <ToneChecker isJapanese={isJapanese} />
      </div>

      {/* Footer */}
    </div>
  );
}

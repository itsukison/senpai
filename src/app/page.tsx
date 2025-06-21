"use client";

import { useState, useRef, useEffect } from "react";
import { ToneChecker } from "@/components/ToneChecker";

export default function Home() {
  const [isJapanese, setIsJapanese] = useState(false);

  const toggleLanguage = () => {
    setIsJapanese(!isJapanese);
  };

  return (
    <div className="min-h-screen bg-slack-white">
      {/* Navigation Bar */}
      <nav className="bg-white border-b border-slate-200 shadow-sm backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-xl font-bold text-slate-800 tracking-tight">
              SenpAI<span className="text-purple-800"> Sensei</span>
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

      {/* Title and Description */}
      <div className="bg-white">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4 tracking-tight">
              SenpAI<span className="text-purple-800"> Sensei</span>
            </h1>
            <p className="text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed font-bold">
              {isJapanese
                ? "リアルタイムで敬意、明確さ、プロフェッショナリズムを持ってコミュニケーションを取るためのプロフェッショナルライティングアシスタント。"
                : "Professional writing assistant that helps you communicate with respect, clarity, and professionalism in real-time."}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto -mt-12 px-6 py-12 bg-white">
        <ToneChecker isJapanese={isJapanese} />
      </div>

      {/* Footer */}
      <div className="border-t border-slack-border mt-16 bg-slack-lightgray">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="text-center text-slack-gray">
            <p className="text-sm">
              {isJapanese
                ? "AIによって駆動 • より良いコミュニケーションのために作られました"
                : "Powered by AI • Built for better communication • Made with ❤️"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

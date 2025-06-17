"use client";

import { useState, useRef, useEffect } from "react";
import { ToneChecker } from "@/components/ToneChecker";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-spotify-black via-spotify-darkgray to-spotify-lightgray">
      {/* Header */}
      <div className="pt-12 pb-8">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center">
            <h1 className="text-5xl md:text-7xl font-bold text-spotify-white mb-4 mt-14">
              SenpAI<span className="text-spotify-green"> Sensei</span>
            </h1>
            <p className="text-xl md:text-xl text-spotify-gray max-w-3xl mx-auto leading-relaxed">
              Professional writing assistant that helps you communicate with
              respect, clarity, and professionalism in real-time.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 pb-12">
        <ToneChecker />
      </div>

      {/* Footer */}
      <div className="border-t border-spotify-lightgray mt-16">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="text-center text-spotify-gray">
            <p className="text-sm">
              Powered by AI • Built for better communication •
              <span className="text-spotify-green"> Made with ❤️</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

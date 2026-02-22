/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Target, Camera, Loader2, X, ChevronRight, Info, Sparkles } from 'lucide-react';
import { analyzeGameScreenshot, MoveSuggestion } from './services/geminiService';
import confetti from 'canvas-confetti';

export default function App() {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<MoveSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCapture = async () => {
    try {
      setError(null);
      
      const nav = navigator as any;
      const mediaDevices = nav.mediaDevices;

      if (!mediaDevices || !mediaDevices.getDisplayMedia) {
        // Fallback for some older browsers or specific environments
        if (!nav.getDisplayMedia) {
          throw new Error("La capture d'écran n'est pas supportée par ce navigateur ou dans ce contexte (Iframe/Mobile).");
        }
      }

      setLoading(true);
      
      const getDisplayMedia = (mediaDevices?.getDisplayMedia?.bind(mediaDevices) || nav.getDisplayMedia?.bind(nav));
      
      const stream = await getDisplayMedia({
        video: { 
          displaySurface: "window",
        },
        audio: false
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        
        // Wait for video to be ready
        videoRef.current.onloadedmetadata = () => {
          setTimeout(() => takeScreenshot(stream), 500);
        };
      }
    } catch (err) {
      console.error("Error starting capture:", err);
      setError("Capture annulée.");
      setLoading(false);
    }
  };

  const takeScreenshot = (stream: MediaStream) => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        setScreenshot(dataUrl);
        analyzeImage(dataUrl);
      }
      
      // Stop all tracks
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const analyzeImage = async (dataUrl: string) => {
    try {
      const result = await analyzeGameScreenshot(dataUrl);
      setSuggestion(result);
      setShowResult(true);
      if (result.confidence > 0.8) {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.7 }
        });
      }
    } catch (err: any) {
      setError(err.message || "Erreur d'analyse.");
    } finally {
      setLoading(false);
    }
  };

  const closeResult = () => {
    setShowResult(false);
    setSuggestion(null);
    setScreenshot(null);
  };

  return (
    <div className="min-h-screen font-sans bg-transparent overflow-hidden">
      {/* Hidden elements for capture */}
      <video ref={videoRef} className="hidden" />
      <canvas ref={canvasRef} className="hidden" />

      {/* Analysis Result Overlay (HUD Style) */}
      <AnimatePresence>
        {showResult && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/20 backdrop-blur-sm"
            onClick={closeResult}
          >
            <div className="relative w-full h-full max-w-lg mx-auto pointer-events-none" onClick={e => e.stopPropagation()}>
              {suggestion && (
                <div className="absolute inset-0">
                  {/* Visual indicator for the column */}
                  <div 
                    className="absolute top-0 bottom-0 bg-emerald-500/5 border-x border-emerald-500/20 flex items-center justify-center"
                    style={{ 
                      left: `${(suggestion.column - 1) * 20}%`, 
                      width: '20%' 
                    }}
                  >
                    <motion.div 
                      animate={{ y: [0, 20, 0], scale: [1, 1.1, 1] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="flex flex-col items-center gap-2"
                    >
                      <Target className="text-emerald-400 w-16 h-16 drop-shadow-[0_0_15px_rgba(52,211,153,0.8)]" />
                      <span className="bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter shadow-lg">
                        ICI
                      </span>
                    </motion.div>
                  </div>

                  {/* Explanation Card */}
                  <motion.div 
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="absolute bottom-12 left-6 right-6 p-5 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl pointer-events-auto"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Sparkles size={14} className="text-emerald-400" />
                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">IA Master</span>
                      </div>
                      <button onClick={closeResult} className="p-1 hover:bg-white/5 rounded-lg transition-colors">
                        <X size={16} className="text-slate-500" />
                      </button>
                    </div>
                    <p className="text-slate-200 text-sm font-medium leading-relaxed">
                      {suggestion.explanation}
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${suggestion.confidence * 100}%` }}
                          className="h-full bg-emerald-500"
                        />
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">
                        {Math.round(suggestion.confidence * 100)}%
                      </span>
                    </div>
                  </motion.div>
                </div>
              )}
            </div>
            
            {/* Tap anywhere to close hint */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/40 backdrop-blur-md rounded-full border border-white/5 text-[10px] text-slate-400 font-bold uppercase tracking-widest pointer-events-none">
              Cliquez n'importe où pour fermer
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Button */}
      <motion.div 
        className="fixed bottom-8 right-8 z-[100]"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
      >
        <button
          onClick={startCapture}
          disabled={loading}
          className={`relative group flex items-center justify-center w-16 h-16 rounded-full shadow-2xl transition-all active:scale-90 disabled:opacity-50 ${loading ? 'bg-slate-800' : 'bg-emerald-500 hover:bg-emerald-400'}`}
        >
          {loading ? (
            <Loader2 className="animate-spin text-emerald-400" size={28} />
          ) : (
            <Target size={28} className="text-slate-900" />
          )}
          
          {/* Pulse Effect */}
          {!loading && !showResult && (
            <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-20 pointer-events-none" />
          )}
        </button>
      </motion.div>

      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-28 right-8 z-[110] bg-red-500/90 backdrop-blur-md text-white px-4 py-2 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-2"
          >
            <X size={14} />
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

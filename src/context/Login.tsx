import React from 'react';
import { useAuth } from './AuthContext';
import { Droplets, ShieldCheck, LogIn } from 'lucide-react';
import { motion } from 'motion/react';

export default function Login() {
  const { loginWithGoogle, loading } = useAuth();

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-surface border border-border p-8 rounded-2xl shadow-xl space-y-8"
      >
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center text-accent">
            <Droplets size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-main">HydroGuard Enterprise</h1>
            <p className="text-text-dim text-sm mt-1">Global Water Quality Intelligence Platform</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-bg rounded-lg border border-border flex items-start gap-3">
            <ShieldCheck className="text-success shrink-0 mt-0.5" size={18} />
            <div className="text-xs text-text-dim leading-relaxed">
              Secure authentication enabled. Access levels are restricted based on your organizational role (Admin, Operator, or Viewer).
            </div>
          </div>

          <button
            onClick={() => loginWithGoogle()}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-text-main text-bg py-3 px-4 rounded-xl font-bold hover:bg-text-main/90 transition-all disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-bg border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <LogIn size={20} />
                Sign in with Google
              </>
            )}
          </button>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold text-text-dim">
              <span className="bg-surface px-2">Authorized Personnel Only</span>
            </div>
          </div>
        </div>

        <div className="text-center">
          <p className="text-[10px] text-text-dim font-mono uppercase tracking-widest">
            v2.4.0 • SECURE GRID AUTH
          </p>
        </div>
      </motion.div>
    </div>
  );
}

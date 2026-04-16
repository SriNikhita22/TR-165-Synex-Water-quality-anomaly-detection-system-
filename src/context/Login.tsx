import React, { useState } from 'react';
import { useAuth, firebaseConfig } from './AuthContext';
import { Droplets, ShieldCheck, LogIn, Mail, Lock, UserPlus, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export default function Login() {
  const { loginWithGoogle, loginWithEmail, signUpWithEmail, loading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isConfigValid = firebaseConfig.apiKey && firebaseConfig.apiKey !== 'demo-key-replace-me';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfigValid) {
      setError('Firebase configuration is missing. Please set up Firebase via the platform tools.');
      return;
    }
    setError(null);
    try {
      if (isLogin) {
        await loginWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-surface border border-border p-8 rounded-2xl shadow-xl space-y-6"
      >
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center text-accent">
            <Droplets size={28} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-main">HydroGuard Enterprise</h1>
            <p className="text-text-dim text-xs mt-1">Global Water Quality Intelligence Platform</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-3 bg-bg rounded-lg border border-border flex items-start gap-3">
            <ShieldCheck className="text-success shrink-0 mt-0.5" size={16} />
            <div className="text-[10px] text-text-dim leading-relaxed">
              Secure authentication enabled. Access levels are restricted based on your organizational role (Admin, Operator, or Viewer).
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-dim uppercase tracking-wider ml-1">Email Address</label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim group-focus-within:text-accent transition-colors" size={16} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    required
                    className="w-full bg-bg/50 border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all placeholder:text-text-dim/50"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-dim uppercase tracking-wider ml-1">Password</label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim group-focus-within:text-accent transition-colors" size={16} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-bg/50 border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all placeholder:text-text-dim/50"
                  />
                </div>
              </div>
            </div>

            <div className="min-h-[20px] relative">
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="space-y-2"
                  >
                    <div className="text-[10px] font-bold text-danger bg-danger/10 p-2 rounded border border-danger/20">
                      {error}
                    </div>
                    {error.includes('api-key-not-valid') && (
                      <div className="space-y-2">
                        <div className="text-[9px] text-text-dim bg-bg p-2 rounded border border-border leading-tight">
                          <p className="font-bold text-accent mb-1 underline uppercase tracking-tighter">Troubleshooting checklist:</p>
                          <ul className="list-disc ml-3 space-y-1">
                            <li>Check if the API Key in <code className="text-secondary font-mono">firebase-applet-config.json</code> is correct.</li>
                            <li>Ensure the Key is for the project <code className="text-secondary font-mono">{firebaseConfig.projectId}</code>.</li>
                            <li>Verify "Identity Platform" or "Firebase Auth" is enabled in Firebase Console.</li>
                            <li>Verify the Key is not restricted by API in GCP Console.</li>
                            <li>Wait 1-2 minutes for GCP changes to propagate after saving.</li>
                          </ul>
                        </div>
                        
                        <div className="p-2 bg-accent/5 rounded border border-accent/20">
                          <p className="text-[8px] font-bold text-accent uppercase mb-1">Check Authorized Domains</p>
                          <p className="text-[9px] text-text-dim mb-1">Make sure these are added in Firebase Console &gt; Auth &gt; Settings:</p>
                          <div className="flex items-center gap-1 bg-bg p-1 rounded font-mono text-[8px] text-secondary border border-border">
                            {window.location.hostname}
                            <button 
                              onClick={() => navigator.clipboard.writeText(window.location.hostname)}
                              className="ml-auto text-[7px] text-accent hover:underline uppercase"
                            >
                              Copy
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-accent text-bg py-2.5 rounded-xl font-bold hover:bg-accent/90 transition-all disabled:opacity-50 shadow-lg shadow-accent/20"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-bg border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  {isLogin ? <LogIn size={18} /> : <UserPlus size={18} />}
                  {isLogin ? 'Sign In' : 'Create Account'}
                </>
              )}
            </button>
          </form>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold text-text-dim">
              <span className="bg-surface px-2">Or continue with</span>
            </div>
          </div>

          <button
            onClick={() => loginWithGoogle()}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-surface border border-border text-text-main py-2.5 rounded-xl font-bold hover:bg-bg transition-all disabled:opacity-50"
          >
            <img 
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
              alt="Google" 
              className="w-4 h-4" 
              referrerPolicy="no-referrer"
            />
            Sign in with Google
          </button>

          <div className="text-center pt-2">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-[10px] font-bold text-accent uppercase hover:underline"
            >
              {isLogin ? "Need an account? Sign up" : "Already have an account? Log in"}
            </button>
          </div>
        </div>

        <div className="text-center">
          <p className="text-[10px] text-text-dim font-mono uppercase tracking-widest bg-bg/50 py-1 rounded border border-border/50">
            v2.4.0 • SECURE GRID AUTH
          </p>
        </div>
      </motion.div>
    </div>
  );
}

import React from 'react';
import { useAuth, UserRole } from './AuthContext';
import Login from './Login';
import { ShieldAlert, Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center space-y-4">
        <Loader2 className="text-accent animate-spin" size={32} />
        <p className="text-xs font-mono text-text-dim uppercase tracking-widest">Verifying Identity...</p>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface border border-border p-8 rounded-2xl text-center space-y-6">
          <div className="w-16 h-16 bg-danger/10 text-danger rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert size={32} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-text-main">Unauthorized Access</h2>
            <p className="text-sm text-text-dim">
              Your account (<strong>{profile.role}</strong>) does not have the required permissions to access this control layer.
            </p>
          </div>
          <button 
            onClick={() => window.location.href = '/'}
            className="text-xs font-bold text-accent uppercase hover:underline"
          >
            Return to Authorized Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

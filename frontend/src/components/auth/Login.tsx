import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bike, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../lib/i18n';
import { toast } from 'sonner';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const { user, login, isLoading: authLoading } = useAuth();
  const { t, language, setLanguage } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      const from = location.state?.from?.pathname || '/users';
      navigate(from, { replace: true });
    }
  }, [user, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error(language === 'fr' ? 'Veuillez remplir tous les champs' : 'Please fill all fields');
      return;
    }

    setIsLoading(true);
    
    try {
      await login(email, password);
      
      const from = location.state?.from?.pathname || '/users';
      navigate(from, { replace: true });
    } catch (error) {
      // Error already handled in authService
      toast.error(language === 'fr' ? 'Échec de la connexion' : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Language Switcher */}
        <div className="flex justify-end mb-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-1 flex gap-1">
            <button
              onClick={() => setLanguage('fr')}
              className={`px-3 py-1 rounded transition-colors ${
                language === 'fr' 
                  ? 'bg-green-600 text-white' 
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              FR
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={`px-3 py-1 rounded transition-colors ${
                language === 'en' 
                  ? 'bg-green-600 text-white' 
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              EN
            </button>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center mb-4">
              <Bike className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-green-600 text-center">FreeBike</h1>
            <p className="text-gray-600 dark:text-gray-300 text-center mt-1">
              {t('auth.login')} - Admin Dashboard
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="email" className="text-gray-700 dark:text-gray-300">
                {t('auth.email')}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder={language === 'fr' ? 'admin@freebike.com' : 'admin@freebike.com'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading || authLoading}
                className="mt-1 text-base" // Prevent zoom on mobile
                autoComplete="email"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-gray-700 dark:text-gray-300">
                {t('auth.password')}
              </Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading || authLoading}
                  className="pr-10 text-base" // Prevent zoom on mobile
                  autoComplete="new-password" // Utilise "new-password" pour éviter les alertes de compromission de l'ancien mot de passe
                  data-lpignore="true" // Ignore LastPass et autres gestionnaires tiers
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading || authLoading}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={showPassword ? 
                    (language === 'fr' ? 'Masquer le mot de passe' : 'Hide password') : 
                    (language === 'fr' ? 'Afficher le mot de passe' : 'Show password')}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="remember" 
                  checked={rememberMe}
                  onCheckedChange={(checked: boolean) => setRememberMe(checked as boolean)}
                  disabled={isLoading || authLoading}
                />
                <label htmlFor="remember" className="text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
                  {t('auth.rememberMe')}
                </label>
              </div>
              <button 
                type="button"
                className="text-sm text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 transition-colors"
                disabled={isLoading || authLoading}
              >
                {t('auth.forgotPassword')}
              </button>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50"
              disabled={isLoading || authLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {language === 'fr' ? 'Connexion...' : 'Signing in...'}
                </>
              ) : (
                t('auth.signIn')
              )}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-600 dark:text-gray-400 text-sm mt-6">
          © 2025 EcoMobile. {language === 'fr' ? 'Tous droits réservés' : 'All rights reserved'}.
        </p>
      </div>
    </div>
  );
}

import React, { createContext, useContext, useState, useEffect } from 'react';

interface Theme {
  primary: string;
  primaryLight: string;
  secondary: string;
  text: string;
  background: string;
}

interface ThemeContextType {
  theme: Theme;
  updateTheme: (newTheme: Partial<Theme>) => void;
  resetTheme: () => void;
  appName: string;
  updateAppName: (name: string) => void;
  logoUrl: string | null;
  updateLogoUrl: (url: string | null) => void;
}

const defaultTheme: Theme = {
  primary: '#7e22ce', // purple-700
  primaryLight: '#faf5ff', // purple-50
  secondary: '#581c87', // purple-900 (used in login bg)
  text: '#111827', // gray-900
  background: '#f9fafb', // gray-50
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('arcontrol_theme');
    const parsed = saved ? JSON.parse(saved) : defaultTheme;
    // Ensure background exists for legacy saves
    return { ...defaultTheme, ...parsed };
  });

  const [appName, setAppName] = useState<string>(() => {
    return localStorage.getItem('arcontrol_app_name') || 'ArControl';
  });

  const [logoUrl, setLogoUrl] = useState<string | null>(() => {
    return localStorage.getItem('arcontrol_logo_url');
  });

  useEffect(() => {
    const root = document.documentElement;
    // Set CSS variables for Tailwind arbitrary values
    root.style.setProperty('--theme-primary', theme.primary);
    root.style.setProperty('--theme-primary-light', theme.primaryLight);
    root.style.setProperty('--theme-secondary', theme.secondary);
    root.style.setProperty('--theme-text', theme.text);
    root.style.setProperty('--theme-bg', theme.background);
    
    // Apply background color to body
    document.body.style.backgroundColor = theme.background;
    
    localStorage.setItem('arcontrol_theme', JSON.stringify(theme));
  }, [theme]);

  useEffect(() => {
    document.title = `${appName} - Gestão de Climatização`;
  }, [appName]);

  const updateAppName = (name: string) => {
    setAppName(name);
    localStorage.setItem('arcontrol_app_name', name);
  };

  const updateLogoUrl = (url: string | null) => {
    setLogoUrl(url);
    if (url) {
      localStorage.setItem('arcontrol_logo_url', url);
    } else {
      localStorage.removeItem('arcontrol_logo_url');
    }
  };

  const updateTheme = (newTheme: Partial<Theme>) => {
    setTheme(prev => ({ ...prev, ...newTheme }));
  };

  const resetTheme = () => {
    setTheme(defaultTheme);
    updateAppName('ArControl');
    updateLogoUrl(null);
  };

  return (
    <ThemeContext.Provider value={{ theme, updateTheme, resetTheme, appName, updateAppName, logoUrl, updateLogoUrl }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

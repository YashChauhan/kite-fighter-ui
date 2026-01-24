import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme, type Theme, useMediaQuery } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  mode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('theme-preference');
    return (saved as ThemeMode) || 'system';
  });

  const actualMode = mode === 'system' ? (prefersDarkMode ? 'dark' : 'light') : mode;

  const theme = useMemo<Theme>(() => {
    return createTheme({
      palette: {
        mode: actualMode,
        primary: {
          main: actualMode === 'dark' ? '#4CAF50' : '#2e7d32',
        },
        secondary: {
          main: actualMode === 'dark' ? '#FFA500' : '#f57c00',
        },
        success: {
          main: '#4CAF50',
        },
        warning: {
          main: '#FFA500',
        },
        error: {
          main: '#F44336',
        },
        background: {
          default: actualMode === 'dark' ? '#121212' : '#fafafa',
          paper: actualMode === 'dark' ? '#1e1e1e' : '#ffffff',
        },
      },
      typography: {
        fontSize: 14,
        button: {
          textTransform: 'none',
          fontWeight: 600,
        },
      },
      components: {
        MuiButton: {
          styleOverrides: {
            root: {
              minHeight: 48,
              borderRadius: 8,
            },
          },
        },
        MuiIconButton: {
          styleOverrides: {
            root: {
              minWidth: 48,
              minHeight: 48,
            },
          },
        },
        MuiFab: {
          styleOverrides: {
            root: {
              minWidth: 56,
              minHeight: 56,
            },
          },
        },
        MuiChip: {
          styleOverrides: {
            root: {
              fontWeight: 500,
            },
          },
        },
      },
      breakpoints: {
        values: {
          xs: 0,
          sm: 600,
          md: 960,
          lg: 1280,
          xl: 1920,
        },
      },
    });
  }, [actualMode]);

  const setThemeMode = (newMode: ThemeMode) => {
    setMode(newMode);
    localStorage.setItem('theme-preference', newMode);
  };

  const toggleTheme = () => {
    const newMode = actualMode === 'light' ? 'dark' : 'light';
    setThemeMode(newMode);
  };

  useEffect(() => {
    localStorage.setItem('theme-preference', mode);
  }, [mode]);

  const value = {
    mode,
    setThemeMode,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

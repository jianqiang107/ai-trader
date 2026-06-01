import { createTheme } from '@mui/material/styles';

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#ff8c00',
      light: '#ffa733',
      dark: '#cc7000',
    },
    secondary: {
      main: '#4a9eff',
      light: '#7ab5ff',
      dark: '#1a7ee5',
    },
    error: {
      main: '#e84040',
    },
    success: {
      main: '#00c0a0',
    },
    background: {
      default: '#0a0a0a',
      paper: '#1c1c1c',
    },
    text: {
      primary: '#e0e0e0',
      secondary: '#aaaaaa',
      disabled: '#666666',
    },
    divider: '#2a2a2a',
  },
  typography: {
    fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
    fontSize: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#1c1c1c',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1c1c1c',
          backgroundImage: 'none',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottomColor: '#2a2a2a',
        },
      },
    },
  },
});

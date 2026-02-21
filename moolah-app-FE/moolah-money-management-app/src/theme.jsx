import { extendTheme } from '@mui/material/styles';

const theme = extendTheme({
  // ✅ This is the important line for Tailwind `.dark { ... }`
  colorSchemeSelector: 'class',

  colorSchemes: {
    light: {
      palette: { mode: 'light' },
    },
    dark: {
      palette: { mode: 'dark' },
    },
  },
});

export default theme;
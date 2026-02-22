import * as React from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Menu from '@mui/material/Menu';
import MenuIcon from '@mui/icons-material/Menu';
import Container from '@mui/material/Container';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import AdbIcon from '@mui/icons-material/Adb';
import PaymentsIcon from '@mui/icons-material/Payments';
import { Link, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from "../../firebase";

// Changes for external API: Importing the new Dialog components
import ExchangeRatesDialog from './ExchangeRatesDialog';
import CryptoDialog from './TopCryptoDialog';

const pages = [
  { name: 'Dashboard', path: '/' },
  { name: 'Transactions', path: '/transactions' },
  { name: 'Budgets', path: '/budgets' },
  { name: 'Goals', path: '/goals' },
  // Changes for external API: We use 'action' instead of 'path' 
  // so the router doesn't try to change the website URL.
  { name: 'Daily Exchange Rates', action: 'openExchange' },
  { name: 'Top 10 CryptoCoins', action: 'openCrypto' }
];

const settings = ['Account', 'Logout'];

function Navbar({ user }) {
  const [anchorElNav, setAnchorElNav] = React.useState(null);
  const [anchorElUser, setAnchorElUser] = React.useState(null);

  // Changes for external API: New state variables to track if popups are open
  const [exchangeOpen, setExchangeOpen] = React.useState(false);
  const [cryptoOpen, setCryptoOpen] = React.useState(false);

  const navigate = useNavigate();

  const handleOpenNavMenu = (event) => {
    setAnchorElNav(event.currentTarget);
  };
  const handleOpenUserMenu = (event) => {
    setAnchorElUser(event.currentTarget);
  };

  const handleCloseNavMenu = () => {
    setAnchorElNav(null);
  };

  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

  // Changes for external API: This function is the "Traffic Controller."
  // It checks if the menu item is a normal page or an API popup.
  const handlePageClick = (page) => {
    handleCloseNavMenu();

    if (page.action === 'openExchange') {
      setExchangeOpen(true); // Opens the Exchange popup
    } else if (page.action === 'openCrypto') {
      setCryptoOpen(true);   // Opens the Crypto popup
    } else if (page.path) {
      navigate(page.path);   // Navigates to a normal page
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      handleCloseUserMenu();
      navigate("/", { replace: true });
    } catch (err) {
      console.error("Logout failed:", err);
      handleCloseUserMenu();
    }
  };

  return (
    <AppBar position="static" sx={{ backgroundColor: '#ffffff', color: 'var(--primary-green-dark)' }}>
      <Container maxWidth="xl">
        <Toolbar disableGutters>
          <PaymentsIcon sx={{ display: { xs: 'none', md: 'flex' }, mr: 1 }} />
          <Typography
            variant="h6"
            noWrap
            component={Link}
            to="/"
            sx={{
              mr: 2,
              display: { xs: 'none', md: 'flex' },
              fontFamily: 'monospace',
              fontWeight: 700,
              letterSpacing: '.3rem',
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            Moolah
          </Typography>

          {/* MOBILE MENU */}
          <Box sx={{ flexGrow: 1, display: { xs: 'flex', md: 'none' } }}>
            <IconButton
              size="large"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleOpenNavMenu}
              color="inherit"
            >
              <MenuIcon />
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorElNav}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              keepMounted
              transformOrigin={{ vertical: 'top', horizontal: 'left' }}
              open={Boolean(anchorElNav)}
              onClose={handleCloseNavMenu}
              sx={{ display: { xs: 'block', md: 'none' } }}
            >
              {pages.map((page) => (
                // Changes for external API: Calling handlePageClick instead of direct navigation
                <MenuItem key={page.name} onClick={() => handlePageClick(page)}>
                  <Typography sx={{ textAlign: 'center' }}>{page.name}</Typography>
                </MenuItem>
              ))}
            </Menu>
          </Box>

          <AdbIcon sx={{ display: { xs: 'flex', md: 'none' }, mr: 1 }} />
          
          {/* DESKTOP MENU */}
          <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' }, justifyContent: 'center', gap: 10 }}>
            {pages.map((page) => (
              <Button
                key={page.name}
                // Changes for external API: We removed component={Link} because 
                // popups are triggered by logic, not by a URL change.
                onClick={() => handlePageClick(page)}
                sx={{ my: 2, color: 'var(--primary-green-dark)', display: 'block', textTransform: 'none', fontWeight: 600 }}
              >
                {page.name}
              </Button>
            ))}
          </Box>

          {/* USER SETTINGS MENU */}
          <Box sx={{ flexGrow: 0 }}>
            <Tooltip title="Open settings">
              <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                <Avatar
                  alt={user?.displayName || user?.email || "User"}
                  src={user?.photoURL || undefined}
                />
              </IconButton>
            </Tooltip>
            <Menu
              sx={{ mt: '45px' }}
              id="menu-appbar"
              anchorEl={anchorElUser}
              anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
              keepMounted
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              open={Boolean(anchorElUser)}
              onClose={handleCloseUserMenu}
            >
              {settings.map((setting) => (
                <MenuItem key={setting} onClick={setting === 'Logout' ? handleLogout : handleCloseUserMenu}>
                  <Typography sx={{ textAlign: 'center' }}>{setting}</Typography>
                </MenuItem>
              ))}
            </Menu>
          </Box>
        </Toolbar>
      </Container>

      {/* Changes for external API: The Dialogs live here. 
          They are invisible until their 'open' prop becomes true. */}
      <ExchangeRatesDialog 
        open={exchangeOpen} 
        onClose={() => setExchangeOpen(false)} 
      />
      <CryptoDialog 
        open={cryptoOpen} 
        onClose={() => setCryptoOpen(false)} 
      />
    </AppBar>
  );
}

export default Navbar;
import { Box, Container, Typography, Link, IconButton, Divider } from '@mui/material';
import PaymentsIcon from '@mui/icons-material/Payments';

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <Box
      component="footer"
      sx={{
        backgroundColor: 'var(--background)',
        color: 'var(--primary-green)',
        py: 1.5,
        mt: 'auto',
        borderTop: '1px solid',
        borderColor: 'var(--border)',
      }}
    >
      <Container maxWidth="xl">
        {/* Main Footer Content */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            justifyContent: 'center',
            alignItems: { xs: 'center', md: 'flex-start' },
            gap: 2,
            mb: 0,
          }}
        >
          <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <PaymentsIcon sx={{ fontSize: 20 }} />
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  letterSpacing: '.3rem',
                  fontSize: '0.9rem',
                }}
              >
                Moolah
              </Typography>
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

export default Footer;

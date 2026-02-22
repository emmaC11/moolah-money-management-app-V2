import { Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Box } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

export default function Modal({ open, onClose, title, children, actions, maxWidth = 'sm' }) {
  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          border: '1px solid var(--border)',
        }
      }}
    >
      <DialogTitle sx={{ 
        m: 0, 
        p: 2, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        borderBottom: '1px solid var(--border)'
      }}>
        <Box sx={{ fontWeight: 600, color: 'var(--primary-green-dark)' }}>
          {title}
        </Box>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            color: 'var(--text-secondary)',
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 3 }}>
        {children}
      </DialogContent>
      {actions && (
        <DialogActions sx={{ p: 2, borderTop: '1px solid var(--border)' }}>
          {actions}
        </DialogActions>
      )}
    </Dialog>
  );
}

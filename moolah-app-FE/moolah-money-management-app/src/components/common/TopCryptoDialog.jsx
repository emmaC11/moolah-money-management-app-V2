import React, { useState, useEffect } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, CircularProgress, 
  List, ListItem, ListItemAvatar, Avatar, ListItemText, 
  Typography, Divider, Box 
} from '@mui/material';

export default function TopCryptoDialog({ open, onClose }) {
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetch('http://localhost:3000/api/v1/crypto/top-10') 
        .then((res) => res.json())
        .then((json) => {
          if (json.success) {
            setCoins(json.data);
          }
          setLoading(false);
        })
        .catch((err) => {
          console.error("Crypto fetch error:", err);
          setLoading(false);
        });
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 'bold', textAlign: 'center', bgcolor: '#f5f5f5' }}>
        Top 10 Crypto Coins
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ p: 0 }}> 
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress color="success" />
          </Box>
        ) : (
          <List>
            {coins.map((coin) => (
              <ListItem key={coin.id} divider>
                <ListItemAvatar>
                  <Avatar src={coin.image} alt={coin.name} sx={{ width: 30, height: 30 }} />
                </ListItemAvatar>
                <ListItemText 
                  primary={coin.name} 
                  secondary={coin.symbol.toUpperCase()} 
                />
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                  ${coin.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Typography>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
}
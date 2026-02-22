import React, { useState, useEffect } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, CircularProgress, 
  List, ListItem, ListItemText, Typography, Divider, Box 
} from '@mui/material';

export default function ExchangeRatesDialog({ open, onClose }) {
  const [rates, setRates] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      setLoading(true);
      // Ensure this matches your server port and v1 route
      fetch('http://localhost:3000/api/v1/currency/latest') 
        .then((res) => res.json())
        .then((json) => {
          if (json.success) {
            // CHANGE HERE: We use json.rates based on your raw data
            setRates(json.rates); 
          }
          setLoading(false);
        })
        .catch((err) => {
          console.error("Currency fetch error:", err);
          setLoading(false);
        });
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 'bold', textAlign: 'center', bgcolor: '#f5f5f5' }}>
        Exchange Rates (Base: EUR)
      </DialogTitle>
      <Divider />
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress color="primary" />
          </Box>
        ) : (
          <List>
            {/* We convert the object into an array: ['AUD', 1.6697] */}
            {Object.entries(rates).map(([currency, value]) => (
              <ListItem key={currency} divider>
                <ListItemText 
                  primary={currency} 
                  secondary={`1 EUR to ${currency}`} 
                />
                <Typography sx={{ fontWeight: 'bold' }}>
                  {/* .toLocaleString handles the commas/decimals nicely */}
                  {value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                </Typography>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
}
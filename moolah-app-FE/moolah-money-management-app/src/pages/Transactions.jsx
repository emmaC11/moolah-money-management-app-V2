import { Typography, Container, Box, Card, CardContent, Button, IconButton, Chip } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { auth } from '../firebase';
import { useState, useEffect } from 'react';

const colDef = [
  { field: 'date', headerName: 'Date' },
  { field: 'description', headerName: 'Description' },
  { field: 'category_name', headerName: 'Category' },
  { field: 'amount', headerName: 'Amount' },
  { field: 'type', headerName: 'Type' },
];

export default function Transactions() {

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // after component mounts, fetch transactions from backend API
  useEffect(() => {
    getTransactions();
  }, []);

  const getTransactions = async () => {
    setLoading(true);
    setError(null);

    try {
      const user = auth.currentUser;

      if (!user) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      const token = await user.getIdToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/transactions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();

      if (data.success) {
        setTransactions(data.data || []);
      } else {
        setError(data.message || 'Failed to fetch transactions');
      }
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header Section */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ color: 'var(--primary-green-dark)', fontWeight: 700, mb: 1 }}>
            Transactions Overview
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
            Review your recent transactions
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          sx={{
            backgroundColor: 'var(--primary-green)',
            textTransform: 'none',
            '&:hover': {
              backgroundColor: 'var(--primary-green-dark)'
            }
          }}
        >
          Add Transaction
        </Button>
      </Box>

      {/* Transactions List */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {transactionData.map((transaction) => (
          <Card key={transaction.id} sx={{ border: '1px solid var(--border)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 2 }}>
                    {colDef.map((col) => (
                      <Box key={col.field}>
                        <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                          {col.headerName}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {col.field === 'type' ? (
                            <Chip
                              label={transaction[col.field]}
                              size="small"
                              sx={{
                                backgroundColor: transaction[col.field] === 'Income' ? 'var(--success-light)' : 'var(--error-light)',
                                color: transaction[col.field] === 'Income' ? 'var(--primary-green-dark)' : 'var(--error)',
                                height: 24
                              }}
                            />
                          ) : (
                            transaction[col.field]
                          )}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <IconButton size="small">
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" sx={{ color: 'var(--error)' }}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Container>
  );
}
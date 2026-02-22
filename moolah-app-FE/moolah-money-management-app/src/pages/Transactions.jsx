import { useEffect, useMemo, useState } from 'react';

import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';

// MUI components
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';

// MUI icons
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

   const colDef = useMemo(
    () => [
      { field: 'type', headerName: 'Type' },
      { field: 'amount', headerName: 'Amount' },
      { field: 'date', headerName: 'Date' },
      { field: 'category', headerName: 'Category' },
      { field: 'description', headerName: 'Description' },
    ],
    []
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setError('Not authenticated');
        setTransactions([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const txRef = collection(db, 'users', user.uid, 'transactions');

        const q = query(txRef, orderBy('date', 'desc'), limit(200));
        const snap = await getDocs(q);

        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setTransactions(items);
      } catch (e) {
        console.error('Firestore transactions read failed:', e);
        setError(e?.message || 'Failed to load transactions');
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const formatAmount = (amount, type) => {
    const num = Number(amount);
    if (Number.isNaN(num)) return '—';
    const formatted = `€${num.toFixed(2)}`;
    return type === 'income' ? `+${formatted}` : `-${formatted}`;
  };

  const formatDate = (value) => {
    if (!value) return '—';

    // Handles:
    // - ISO string like "2026-02-21"
    // - JS Date
    // - Firestore Timestamp (has toDate())
    let dateObj;

    if (typeof value === 'string' || typeof value === 'number') {
      dateObj = new Date(value);
    } else if (value instanceof Date) {
      dateObj = value;
    } else if (typeof value?.toDate === 'function') {
      dateObj = value.toDate();
    }

    if (!dateObj || Number.isNaN(dateObj.getTime())) return '—';
    return dateObj.toLocaleDateString('en-IE');
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4, textAlign: 'center' }}>
        <Typography sx={{ mt: 2 }}>Loading transactions...</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header Section */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            sx={{
              color: 'var(--primary-green-dark)',
              fontWeight: 700,
              mb: 1,
            }}
          >
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
            '&:hover': { backgroundColor: 'var(--primary-green-dark)' },
          }}
          onClick={() => console.log('Add Transaction clicked')}
        >
          Add Transaction
        </Button>
      </Box>

      {/* Error Message */}
      {error && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body1" sx={{ color: 'var(--error)' }}>
            {error}
          </Typography>
        </Box>
      )}

      {/* No transactions */}
      {!error && transactions.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="h6" sx={{ color: 'var(--text-muted)', mb: 2 }}>
            No transactions yet
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
            Click &quot;Add Transaction&quot; to create your first transaction
          </Typography>
        </Box>
      )}

      {/* Transactions List */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {transactions.map((transaction) => (
          <Card
            key={transaction.id ?? `${transaction.date}-${transaction.amount}-${transaction.type}`}
            sx={{ border: '1px solid var(--border)' }}
          >
            <CardContent>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center', 
                }}
              >
                <Box sx={{ flex: 1 }}>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(5, 1fr)',
                      gap: 2,
                    }}
                  >
                    {colDef.map((col) => (
                      <Box key={col.field}>
                        <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                          {col.headerName}
                        </Typography>

                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {col.field === 'type' ? (
                            <Chip
                              label={transaction.type || '—'}
                              size="small"
                              sx={{
                                backgroundColor:
                                  transaction.type === 'income'
                                    ? 'var(--success-light)'
                                    : 'var(--error-light)',
                                color:
                                  transaction.type === 'income'
                                    ? 'var(--primary-green-dark)'
                                    : 'var(--error)',
                                height: 24,
                              }}
                            />
                          ) : col.field === 'amount' ? (
                            <span
                              style={{
                                color:
                                  transaction.type === 'income'
                                    ? 'var(--primary-green)'
                                    : 'var(--error)',
                              }}
                            >
                              {transaction.amount !== undefined
                                ? formatAmount(transaction.amount, transaction.type)
                                : '—'}
                            </span>
                          ) : col.field === 'date' ? (
                            formatDate(transaction.date)
                          ) : (
                            transaction[col.field] ?? '—'
                          )}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 1 }}>
                  <IconButton size="small" onClick={() => console.log('Edit', transaction.id)}>
                    <EditIcon fontSize="small" />
                  </IconButton>

                  <IconButton
                    size="small"
                    sx={{ color: 'var(--error)' }}
                    onClick={() => console.log('Delete', transaction.id)}
                  >
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
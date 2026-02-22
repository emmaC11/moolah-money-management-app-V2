import { useEffect, useMemo, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  addDoc,
  updateDoc,
  doc,
  Timestamp,
} from 'firebase/firestore';

// MUI components
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';

// Dialog components
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';

// Icons
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [currentUser, setCurrentUser] = useState(null);

  const [openAdd, setOpenAdd] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const [form, setForm] = useState({
    type: 'expense',
    amount: '',
    date: '',
    category: '',
    description: '',
  });

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
      setCurrentUser(user ?? null);

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

  const openAddDialog = () => {
    setFormError(null);
    setEditingTransaction(null);
    setForm({
      type: 'expense',
      amount: '',
      date: '',
      category: '',
      description: '',
    });
    setOpenAdd(true);
  };

  const openEditDialog = (tx) => {
    setFormError(null);
    setEditingTransaction(tx);
    let dateStr = '';
    if (tx.date) {
      const d = typeof tx.date?.toDate === 'function' ? tx.date.toDate() : new Date(tx.date);
      dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    setForm({
      type: tx.type || 'expense',
      amount: String(tx.amount || ''),
      date: dateStr,
      category: tx.category || '',
      description: tx.description || '',
    });
    setOpenAdd(true);
  };

  const closeAddDialog = () => {
    if (!saving) setOpenAdd(false);
  };

  const onFormChange = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const saveTransaction = async () => {
    setFormError(null);

    if (!currentUser) {
      setFormError('You must be logged in.');
      return;
    }

    if (!form.type || !form.amount || !form.date || !form.category || !form.description) {
      setFormError('Please complete all fields.');
      return;
    }

    const amountNum = Number(form.amount);
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      setFormError('Amount must be a positive number.');
      return;
    }

    const dateAsTimestamp = Timestamp.fromDate(new Date(`${form.date}T00:00:00`));
    setSaving(true);

    try {
      if (editingTransaction) {
        await updateDoc(
          doc(db, 'users', currentUser.uid, 'transactions', editingTransaction.id),
          {
            type: form.type,
            amount: amountNum,
            date: dateAsTimestamp,
            category: form.category.trim(),
            description: form.description.trim(),
          }
        );
        setTransactions((prev) =>
          prev.map((t) =>
            t.id === editingTransaction.id
              ? { ...t, type: form.type, amount: amountNum, date: dateAsTimestamp, category: form.category.trim(), description: form.description.trim() }
              : t
          )
        );
      } else {
        const txRef = collection(db, 'users', currentUser.uid, 'transactions');
        const payload = {
          type: form.type,
          amount: amountNum,
          date: dateAsTimestamp,
          category: form.category.trim(),
          description: form.description.trim(),
          userId: currentUser.uid,
        };
        const docRef = await addDoc(txRef, payload);
        const newItem = { id: docRef.id, ...payload };
        setTransactions((prev) => {
          const merged = [newItem, ...prev];
          merged.sort((a, b) => {
            const aMs = a.date?.toMillis ? a.date.toMillis() : new Date(a.date).getTime();
            const bMs = b.date?.toMillis ? b.date.toMillis() : new Date(b.date).getTime();
            return bMs - aMs;
          });
          return merged;
        });
      }

      setOpenAdd(false);
    } catch (e) {
      console.error('Save transaction failed:', e);
      setFormError(e?.message || 'Failed to save transaction.');
    } finally {
      setSaving(false);
    }
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
      {/* HEADER */}
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

        {/* ✅ UPDATED BUTTON — BLACK TEXT + BLACK ICON */}
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          sx={{
            backgroundColor: 'var(--primary-green)',
            color: '#000', // BLACK TEXT
            textTransform: 'none',

            '& .MuiButton-startIcon, & .MuiSvgIcon-root': {
              color: '#000', // BLACK ICON
            },

            '&:hover': {
              backgroundColor: 'var(--primary-green-dark)',
              color: '#000',
              '& .MuiSvgIcon-root': { color: '#000' },
            },
          }}
          onClick={openAddDialog}
        >
          Add Transaction
        </Button>
      </Box>

      {/* ADD TRANSACTION DIALOG */}
      <Dialog open={openAdd} onClose={closeAddDialog} fullWidth maxWidth="sm">
        <DialogTitle>{editingTransaction ? 'Edit Transaction' : 'Add Transaction'}</DialogTitle>

        <DialogContent sx={{ pt: 1 }}>
          {formError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {formError}
            </Alert>
          )}

          {/* TYPE SELECT */}
          <TextField
            select
            fullWidth
            margin="dense"
            label="Type"
            value={form.type}
            onChange={onFormChange('type')}
            sx={{
              '& .MuiSelect-select': { color: 'var(--text-primary)' },
              '& .MuiInputLabel-root': { color: 'var(--text-secondary)' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border)' },
            }}
          >
            <MenuItem value="expense">Expense</MenuItem>
            <MenuItem value="income">Income</MenuItem>
          </TextField>

          <TextField
            fullWidth
            margin="dense"
            label="Amount (€)"
            value={form.amount}
            onChange={onFormChange('amount')}
            inputProps={{ inputMode: 'decimal' }}
          />

          <TextField
            fullWidth
            margin="dense"
            label="Date"
            type="date"
            value={form.date}
            onChange={onFormChange('date')}
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            fullWidth
            margin="dense"
            label="Category"
            value={form.category}
            onChange={onFormChange('category')}
          />

          <TextField
            fullWidth
            margin="dense"
            label="Description"
            value={form.description}
            onChange={onFormChange('description')}
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeAddDialog} disabled={saving} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            onClick={saveTransaction}
            disabled={saving}
            variant="contained"
            sx={{ textTransform: 'none' }}
          >
            {saving ? 'Saving…' : editingTransaction ? 'Update' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ERROR */}
      {error && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body1" sx={{ color: 'var(--error)' }}>
            {error}
          </Typography>
        </Box>
      )}

      {/* NO TRANSACTIONS */}
      {!error && transactions.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="h6" sx={{ color: 'var(--text-muted)', mb: 2 }}>
            No transactions yet
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
            Click "Add Transaction" to create your first transaction
          </Typography>
        </Box>
      )}

      {/* TRANSACTIONS LIST */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {transactions.map((transaction) => (
          <Card
            key={transaction.id}
            sx={{ border: '1px solid var(--border)' }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
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
                              label={transaction.type}
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
                              }}
                            />
                          ) : col.field === 'amount' ? (
                            formatAmount(transaction.amount, transaction.type)
                          ) : col.field === 'date' ? (
                            formatDate(transaction.date)
                          ) : (
                            transaction[col.field] || '—'
                          )}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 1 }}>
                  <IconButton onClick={() => openEditDialog(transaction)}>
                    <EditIcon fontSize="small" />
                  </IconButton>

                  <IconButton
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
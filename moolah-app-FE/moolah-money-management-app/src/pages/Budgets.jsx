import {
  Typography,
  Container,
  Box,
  Card,
  CardContent,
  Button,
  IconButton,
  LinearProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useEffect, useState, useMemo } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
  query,
  limit,
  serverTimestamp,
} from 'firebase/firestore';

export default function Budgets() {
  const [budgets, setBudgets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  // Dialog state
  const [openDialog, setOpenDialog] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const [form, setForm] = useState({
    name: '',
    amount: '',
    categoryId: '',
    periodStart: '',
    periodEnd: '',
  });

  // Derive unique category strings from transactions
  const categoryOptions = useMemo(() => {
    const seen = new Set();
    return transactions
      .map((t) => t.category)
      .filter((c) => c && !seen.has(c) && seen.add(c));
  }, [transactions]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user ?? null);

      if (!user) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        await Promise.all([loadBudgets(user), loadTransactions(user)]);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const loadBudgets = async (user) => {
    const ref = collection(db, 'users', user.uid, 'budgets');
    const q = query(ref, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    setBudgets(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  const loadTransactions = async (user) => {
    const ref = collection(db, 'users', user.uid, 'transactions');
    const q = query(ref, orderBy('date', 'desc'), limit(200));
    const snap = await getDocs(q);
    setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  // ---- Form handlers ----

  const onFormChange = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const openAddDialog = () => {
    setFormError(null);
    setForm({ name: '', amount: '', categoryId: '', periodStart: '', periodEnd: '' });
    setEditingBudget(null);
    setOpenDialog(true);
  };

  const openEditDialog = (budget) => {
    setFormError(null);
    setForm({
      name: budget.name || '',
      amount: budget.amount || '',
      categoryId: budget.categoryId || '',
      periodStart: budget.periodStart || '',
      periodEnd: budget.periodEnd || '',
    });
    setEditingBudget(budget);
    setOpenDialog(true);
  };

  const closeDialog = () => {
    if (!saving) setOpenDialog(false);
  };

  const saveBudget = async () => {
    setFormError(null);

    if (!currentUser) {
      setFormError('You must be logged in.');
      return;
    }

    if (!form.name || !form.amount || !form.categoryId) {
      setFormError('Please complete Name, Amount, and Category.');
      return;
    }

    const amountNum = Number(form.amount);
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      setFormError('Amount must be a positive number.');
      return;
    }

    setSaving(true);
    try {
      const budgetsRef = collection(db, 'users', currentUser.uid, 'budgets');

      if (editingBudget) {
        const budgetDoc = doc(db, 'users', currentUser.uid, 'budgets', editingBudget.id);
        await updateDoc(budgetDoc, {
          name: form.name.trim(),
          amount: amountNum,
          categoryId: form.categoryId,
          periodStart: form.periodStart || null,
          periodEnd: form.periodEnd || null,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(budgetsRef, {
          name: form.name.trim(),
          amount: amountNum,
          categoryId: form.categoryId,
          periodStart: form.periodStart || null,
          periodEnd: form.periodEnd || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      await loadBudgets(currentUser);
      setOpenDialog(false);
    } catch (err) {
      console.error('Save budget failed:', err);
      setFormError(err.message || 'Failed to save budget.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBudget = async (budgetId) => {
    if (!window.confirm('Are you sure you want to delete this budget?')) return;

    try {
      await deleteDoc(doc(db, 'users', currentUser.uid, 'budgets', budgetId));
      setBudgets((prev) => prev.filter((b) => b.id !== budgetId));
    } catch (err) {
      console.error('Delete budget failed:', err);
      setError(err.message || 'Failed to delete budget.');
    }
  };

  // ---- Calculations ----

  // categoryId is the transaction category string, so match directly
  const getSpentForCategory = (categoryId) => {
    return transactions
      .filter((t) => t.category === categoryId && t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);
  };

  const totalBudget = budgets.reduce((sum, b) => sum + Number(b.amount), 0);
  const totalSpent = budgets.reduce((sum, b) => sum + getSpentForCategory(b.categoryId), 0);
  const totalRemaining = totalBudget - totalSpent;

  const enrichedBudgets = budgets.map((budget) => {
    const spent = getSpentForCategory(budget.categoryId);
    const remaining = Number(budget.amount) - spent;
    return {
      ...budget,
      spent: spent.toFixed(2),
      remaining: remaining.toFixed(2),
    };
  });

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ color: 'var(--primary-green-dark)', fontWeight: 700, mb: 1 }}>
            Budget Overview
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
            Manage and compare all your budgets
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openAddDialog}
          sx={{
            backgroundColor: 'var(--primary-green)',
            color: '#000',
            textTransform: 'none',
            '& .MuiButton-startIcon, & .MuiSvgIcon-root': { color: '#000' },
            '&:hover': {
              backgroundColor: 'var(--primary-green-dark)',
              color: '#000',
            },
          }}
        >
          Add Budget
        </Button>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Add / Edit Budget Dialog */}
      <Dialog open={openDialog} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>{editingBudget ? 'Edit Budget' : 'Add Budget'}</DialogTitle>

        <DialogContent sx={{ pt: 1 }}>
          {formError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {formError}
            </Alert>
          )}

          <TextField
            fullWidth
            margin="dense"
            label="Budget Name"
            value={form.name}
            onChange={onFormChange('name')}
          />

          <TextField
            fullWidth
            margin="dense"
            label="Amount (€)"
            value={form.amount}
            onChange={onFormChange('amount')}
            inputProps={{ inputMode: 'decimal' }}
          />

          <TextField
            select
            fullWidth
            margin="dense"
            label="Category"
            value={form.categoryId}
            onChange={onFormChange('categoryId')}
          >
            {categoryOptions.length === 0 ? (
              <MenuItem disabled>No categories found — add a transaction first</MenuItem>
            ) : (
              categoryOptions.map((cat) => (
                <MenuItem key={cat} value={cat}>
                  {cat}
                </MenuItem>
              ))
            )}
          </TextField>

          <TextField
            fullWidth
            margin="dense"
            label="Period Start"
            type="date"
            value={form.periodStart}
            onChange={onFormChange('periodStart')}
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            fullWidth
            margin="dense"
            label="Period End"
            type="date"
            value={form.periodEnd}
            onChange={onFormChange('periodEnd')}
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDialog} disabled={saving} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            onClick={saveBudget}
            disabled={saving}
            variant="contained"
            sx={{
              textTransform: 'none',
              backgroundColor: 'var(--primary-green)',
              '&:hover': { backgroundColor: 'var(--primary-green-dark)' },
            }}
          >
            {saving ? 'Saving…' : editingBudget ? 'Update Budget' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Summary Card */}
      <Card sx={{ mb: 3, mt: 3, border: '1px solid var(--border)' }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ color: 'var(--text-secondary)', mb: 0.5 }}>
                Total Budget Summary
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                All Budgets Combined
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
            <Card sx={{ backgroundColor: '#DCFCE7', border: 'none', boxShadow: 'none' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                  <TrendingUpIcon sx={{ color: 'var(--primary-green)', fontSize: 20 }} />
                </Box>
                <Typography variant="h5" sx={{ textAlign: 'center', fontWeight: 600, color: 'var(--primary-green)' }}>
                  €{totalBudget.toFixed(2)}
                </Typography>
                <Typography variant="caption" sx={{ textAlign: 'center', display: 'block', color: 'var(--text-secondary)' }}>
                  Total Budget
                </Typography>
              </CardContent>
            </Card>

            <Card sx={{ backgroundColor: '#FEE2E2', border: 'none', boxShadow: 'none' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                  <TrendingDownIcon sx={{ color: 'var(--error)', fontSize: 20 }} />
                </Box>
                <Typography variant="h5" sx={{ textAlign: 'center', fontWeight: 600, color: 'var(--error)' }}>
                  €{totalSpent.toFixed(2)}
                </Typography>
                <Typography variant="caption" sx={{ textAlign: 'center', display: 'block', color: 'var(--text-secondary)' }}>
                  Total Spent
                </Typography>
              </CardContent>
            </Card>

            <Card sx={{ backgroundColor: '#F3F4F6', border: 'none', boxShadow: 'none' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                  <AccountBalanceWalletIcon sx={{ color: 'var(--text-secondary)', fontSize: 20 }} />
                </Box>
                <Typography
                  variant="h5"
                  sx={{
                    textAlign: 'center',
                    fontWeight: 600,
                    color: totalRemaining >= 0 ? 'var(--primary-green)' : 'var(--error)',
                  }}
                >
                  €{totalRemaining.toFixed(2)}
                </Typography>
                <Typography variant="caption" sx={{ textAlign: 'center', display: 'block', color: 'var(--text-secondary)' }}>
                  Remaining
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </CardContent>
      </Card>

      {/* Budget List */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {enrichedBudgets.length === 0 && !loading ? (
          <Card sx={{ border: '1px solid var(--border)', p: 4 }}>
            <Typography variant="body1" sx={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
              No budgets yet. Click "Add Budget" to create your first budget.
            </Typography>
          </Card>
        ) : (
          enrichedBudgets.map((budget) => {
            const percentageSpent =
              budget.amount > 0 ? (Number(budget.spent) / Number(budget.amount)) * 100 : 0;
            const isOverBudget = percentageSpent > 100;

            return (
              <Card key={budget.id} sx={{ border: '1px solid var(--border)' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          {budget.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                          Category: {budget.categoryId || 'Unknown'}
                        </Typography>
                      </Box>

                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 2 }}>
                        <Box>
                          <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                            Budget Amount
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500, mt: 0.5 }}>
                            €{Number(budget.amount).toFixed(2)}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                            Spent
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 500,
                              mt: 0.5,
                              color: isOverBudget ? 'var(--error)' : 'inherit',
                            }}
                          >
                            €{budget.spent}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                            Remaining
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 500,
                              mt: 0.5,
                              color: Number(budget.remaining) >= 0 ? 'var(--primary-green)' : 'var(--error)',
                            }}
                          >
                            €{budget.remaining}
                          </Typography>
                        </Box>
                      </Box>

                      {/* Progress Bar */}
                      <Box sx={{ mt: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                            Budget Usage
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              fontWeight: 600,
                              color: isOverBudget ? 'var(--error)' : 'var(--text-secondary)',
                            }}
                          >
                            {percentageSpent.toFixed(1)}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(percentageSpent, 100)}
                          sx={{
                            height: 8,
                            borderRadius: 1,
                            backgroundColor: '#E5E7EB',
                            '& .MuiLinearProgress-bar': {
                              backgroundColor: isOverBudget
                                ? 'var(--error)'
                                : percentageSpent > 80
                                ? '#F59E0B'
                                : 'var(--primary-green)',
                            },
                          }}
                        />
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1, ml: 2 }}>
                      <IconButton
                        size="small"
                        onClick={() => openEditDialog(budget)}
                        sx={{ color: 'var(--primary-green)' }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        sx={{ color: 'var(--error)' }}
                        onClick={() => handleDeleteBudget(budget.id)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            );
          })
        )}
      </Box>
    </Container>
  );
}

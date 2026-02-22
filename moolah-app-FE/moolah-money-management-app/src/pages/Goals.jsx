import { useEffect, useMemo, useState } from 'react';
import {
  Typography,
  Container,
  Box,
  Card,
  CardContent,
  Button,
  IconButton,
  LinearProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
} from '@mui/material';

import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SavingsIcon from '@mui/icons-material/Savings';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';

import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  where,
  Timestamp,
  deleteDoc,
  doc,
  updateDoc,
  increment,
} from 'firebase/firestore';

// Dropdown options for goal type (chip displays this type)
const GOAL_TYPES = [
  { value: 'rainy-day-fund', label: 'Rainy Day Fund' },
  { value: 'dream-vacation', label: 'Dream Vacation' },
  { value: 'new-gadget', label: 'New Gadget' },
  { value: 'home-down-payment', label: 'Home Down Payment' },
  { value: 'debt-repayment', label: 'Debt Repayment' },
  { value: 'retirement-savings', label: 'Retirement Savings' },
];

export default function Goals() {
  const [goals, setGoals] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Add-goal dialog + form
  const [openAdd, setOpenAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const [form, setForm] = useState({
    type: GOAL_TYPES[0].value,
    name: '',
    description: '',
    target: '',
    deadline: '', // YYYY-MM-DD
  });

  // ✅ Add Money dialog + form (new)
  const [openAddMoney, setOpenAddMoney] = useState(false);
  const [addMoneySaving, setAddMoneySaving] = useState(false);
  const [addMoneyError, setAddMoneyError] = useState(null);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [moneyAmount, setMoneyAmount] = useState('');

  // ---------------- Helpers ----------------

  const calculateProgress = (current, target) => {
    const cur = Number(current);
    const tar = Number(target);
    if (!tar || Number.isNaN(cur) || Number.isNaN(tar)) return 0;
    return (cur / tar) * 100;
  };

  const formatDeadline = (value) => {
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

  const typeLabel = useMemo(() => {
    const map = new Map(GOAL_TYPES.map((t) => [t.value, t.label]));
    return (value) => map.get(value) || value;
  }, []);

  const onFormChange = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const openAddDialog = () => {
    setFormError(null);
    setForm({
      type: GOAL_TYPES[0].value,
      name: '',
      description: '',
      target: '',
      deadline: '',
    });
    setOpenAdd(true);
  };

  const closeAddDialog = () => {
    if (!saving) setOpenAdd(false);
  };

  // ✅ Open/close Add Money dialog (new)
  const openAddMoneyDialog = (goal) => {
    setAddMoneyError(null);
    setSelectedGoal(goal);
    setMoneyAmount('');
    setOpenAddMoney(true);
  };

  const closeAddMoneyDialog = () => {
    if (!addMoneySaving) setOpenAddMoney(false);
  };

  // ---------------- Load Goals ----------------
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user ?? null);

      if (!user) {
        setError('Not authenticated');
        setGoals([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const goalsRef = collection(db, 'goals');
        const q = query(
          goalsRef,
          where('userId', '==', user.uid),
          orderBy('deadline', 'asc')
        );

        const snap = await getDocs(q);
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setGoals(items);
      } catch (e) {
        console.error('Firestore goals read failed:', e);
        setError(e?.message || 'Failed to load goals');
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  // ---------------- Add Goal ----------------
  const addGoal = async () => {
    setFormError(null);

    if (!currentUser) {
      setFormError('You must be logged in to create a goal.');
      return;
    }

    if (!form.type || !form.name || !form.target || !form.deadline) {
      setFormError('Please complete Type, Name, Target, and Deadline.');
      return;
    }

    const targetNum = Number(form.target);
    if (Number.isNaN(targetNum) || targetNum <= 0) {
      setFormError('Target must be a positive number.');
      return;
    }

    const deadlineTs = Timestamp.fromDate(new Date(`${form.deadline}T00:00:00`));

    setSaving(true);
    try {
      const goalsRef = collection(db, 'goals');

      const payload = {
        userId: currentUser.uid,
        type: form.type,
        name: form.name.trim(),
        description: form.description.trim(),
        target: targetNum,
        current: 0,
        deadline: deadlineTs,
        createdAt: Timestamp.now(),
      };

      const docRef = await addDoc(goalsRef, payload);
      const newItem = { id: docRef.id, ...payload };

      setGoals((prev) => {
        const merged = [newItem, ...prev];
        merged.sort((a, b) => {
          const aMs = a.deadline?.toMillis ? a.deadline.toMillis() : new Date(a.deadline).getTime();
          const bMs = b.deadline?.toMillis ? b.deadline.toMillis() : new Date(b.deadline).getTime();
          return aMs - bMs;
        });
        return merged;
      });

      setOpenAdd(false);
    } catch (e) {
      console.error('Add goal failed:', e);
      setFormError(e?.message || 'Failed to create goal.');
    } finally {
      setSaving(false);
    }
  };

  // ---------------- Delete Goal ----------------
  const deleteGoal = async (goalId) => {
    if (!currentUser) {
      setError('You must be logged in to delete a goal.');
      return;
    }

    const ok = window.confirm('Delete this goal? This cannot be undone.');
    if (!ok) return;

    try {
      await deleteDoc(doc(db, 'goals', goalId));
      setGoals((prev) => prev.filter((g) => g.id !== goalId));
    } catch (e) {
      console.error('Delete goal failed:', e);
      setError(e?.message || 'Failed to delete goal');
    }
  };

  // ✅ Add Money (new)
  const addMoneyToGoal = async () => {
    setAddMoneyError(null);

    if (!currentUser) {
      setAddMoneyError('You must be logged in to add money.');
      return;
    }
    if (!selectedGoal?.id) {
      setAddMoneyError('No goal selected.');
      return;
    }

    const amountNum = Number(moneyAmount);
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      setAddMoneyError('Amount must be a positive number.');
      return;
    }

    setAddMoneySaving(true);
    try {
      // Atomic increment in Firestore
      await updateDoc(doc(db, 'goals', selectedGoal.id), {
        current: increment(amountNum),
      });

      // Update UI immediately (simple)
      setGoals((prev) =>
        prev.map((g) =>
          g.id === selectedGoal.id
            ? { ...g, current: Number(g.current || 0) + amountNum }
            : g
        )
      );

      setOpenAddMoney(false);
    } catch (e) {
      console.error('Add money failed:', e);
      setAddMoneyError(e?.message || 'Failed to add money.');
    } finally {
      setAddMoneySaving(false);
    }
  };

  // ---------------- Summary Cards ----------------
  const totalGoals = goals.length;
  const totalSaved = goals.reduce((sum, goal) => sum + Number(goal.current || 0), 0);
  const totalTarget = goals.reduce((sum, goal) => sum + Number(goal.target || 0), 0);

  // ---------------- Render ----------------
  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4, textAlign: 'center' }}>
        <Typography sx={{ mt: 2 }}>Loading goals...</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header Section */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ color: 'var(--primary-green-dark)', fontWeight: 700, mb: 1 }}>
            Savings Goals
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
            Track your progress towards financial milestones
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          sx={{
            backgroundColor: 'var(--primary-green)',
            color: '#000',
            textTransform: 'none',
            '& .MuiButton-startIcon, & .MuiSvgIcon-root': { color: '#000' },
            '&:hover': { backgroundColor: 'var(--primary-green-dark)', color: '#000' },
          }}
          onClick={openAddDialog}
        >
          Create New Goal
        </Button>
      </Box>

      {/* Add Goal Dialog */}
      <Dialog open={openAdd} onClose={closeAddDialog} fullWidth maxWidth="sm">
        <DialogTitle>Create New Goal</DialogTitle>

        <DialogContent sx={{ pt: 1 }}>
          {formError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {formError}
            </Alert>
          )}

          <TextField select fullWidth margin="dense" label="Type" value={form.type} onChange={onFormChange('type')}>
            {GOAL_TYPES.map((t) => (
              <MenuItem key={t.value} value={t.value}>
                {t.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            fullWidth
            margin="dense"
            label="Name"
            value={form.name}
            onChange={onFormChange('name')}
            placeholder="e.g., ‘Save for summer trip’, ‘Pay off credit card’"
          />

          <TextField
            fullWidth
            margin="dense"
            label="Description (optional)"
            value={form.description}
            onChange={onFormChange('description')}
          />

          <TextField
            fullWidth
            margin="dense"
            label="Target (€)"
            value={form.target}
            onChange={onFormChange('target')}
            inputProps={{ inputMode: 'decimal' }}
          />

          <TextField
            fullWidth
            margin="dense"
            label="Deadline"
            type="date"
            value={form.deadline}
            onChange={onFormChange('deadline')}
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeAddDialog} disabled={saving} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button onClick={addGoal} disabled={saving} variant="contained" sx={{ textTransform: 'none' }}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ✅ Add Money Dialog (new) */}
      <Dialog open={openAddMoney} onClose={closeAddMoneyDialog} fullWidth maxWidth="xs">
        <DialogTitle>Add Money</DialogTitle>

        <DialogContent sx={{ pt: 1 }}>
          {addMoneyError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {addMoneyError}
            </Alert>
          )}

          <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 1 }}>
            Goal: <strong>{selectedGoal?.name || '—'}</strong>
          </Typography>

          <TextField
            fullWidth
            margin="dense"
            label="Amount (€)"
            value={moneyAmount}
            onChange={(e) => setMoneyAmount(e.target.value)}
            inputProps={{ inputMode: 'decimal' }}
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeAddMoneyDialog} disabled={addMoneySaving} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            onClick={addMoneyToGoal}
            disabled={addMoneySaving}
            variant="contained"
            sx={{ textTransform: 'none' }}
          >
            {addMoneySaving ? 'Saving…' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Error message */}
      {error && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body1" sx={{ color: 'var(--error)' }}>
            {error}
          </Typography>
        </Box>
      )}

      {/* Summary Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 3 }}>
        <Card sx={{ backgroundColor: '#E0E7FF', border: 'none', boxShadow: 'none' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
              <SavingsIcon sx={{ color: '#3730A3', fontSize: 20 }} />
            </Box>
            <Typography variant="h5" sx={{ textAlign: 'center', fontWeight: 600, color: '#3730A3' }}>
              {totalGoals}
            </Typography>
            <Typography variant="caption" sx={{ textAlign: 'center', display: 'block', color: 'var(--text-secondary)' }}>
              Active Goals
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ backgroundColor: '#DCFCE7', border: 'none', boxShadow: 'none' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
              <TrendingUpIcon sx={{ color: 'var(--primary-green)', fontSize: 20 }} />
            </Box>
            <Typography variant="h5" sx={{ textAlign: 'center', fontWeight: 600, color: 'var(--primary-green)' }}>
              €{totalSaved.toLocaleString()}
            </Typography>
            <Typography variant="caption" sx={{ textAlign: 'center', display: 'block', color: 'var(--text-secondary)' }}>
              Total Saved
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ backgroundColor: '#FEF3C7', border: 'none', boxShadow: 'none' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
              <AccountBalanceIcon sx={{ color: '#92400E', fontSize: 20 }} />
            </Box>
            <Typography variant="h5" sx={{ textAlign: 'center', fontWeight: 600, color: '#92400E' }}>
              €{totalTarget.toLocaleString()}
            </Typography>
            <Typography variant="caption" sx={{ textAlign: 'center', display: 'block', color: 'var(--text-secondary)' }}>
              Total Target
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* No goals */}
      {!error && goals.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="h6" sx={{ color: 'var(--text-muted)', mb: 2 }}>
            No goals yet
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
            Click "Create New Goal" to create your first goal
          </Typography>
        </Box>
      )}

      {/* Goals List */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {goals.map((goal) => {
          const progress = calculateProgress(goal.current, goal.target);

          return (
            <Card key={goal.id} sx={{ border: '1px solid var(--border)' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {goal.name}
                      </Typography>

                      <Chip
                        label={typeLabel(goal.type)}
                        size="small"
                        sx={{
                          backgroundColor: '#E0E7FF',
                          color: '#3730A3',
                          height: 20,
                          textTransform: 'capitalize',
                        }}
                      />
                    </Box>

                    {goal.description && (
                      <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 2 }}>
                        {goal.description}
                      </Typography>
                    )}

                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 2 }}>
                      <Box>
                        <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                          Target
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          €{Number(goal.target || 0).toLocaleString()}
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                          Current
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          €{Number(goal.current || 0).toLocaleString()}
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                          Deadline
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {formatDeadline(goal.deadline)}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Progress Bar */}
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                          Progress
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                          {progress.toFixed(1)}%
                        </Typography>
                      </Box>

                      <LinearProgress
                        variant="determinate"
                        value={progress > 100 ? 100 : progress}
                        sx={{
                          height: 8,
                          borderRadius: 1,
                          backgroundColor: '#E5E7EB',
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: progress >= 100 ? 'var(--primary-green)' : '#3B82F6',
                          },
                        }}
                      />

                      <Typography
                        variant="caption"
                        sx={{ color: 'var(--text-secondary)', mt: 0.5, display: 'block' }}
                      >
                        €{Number(goal.current || 0).toLocaleString()} of €{Number(goal.target || 0).toLocaleString()}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1, ml: 2 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      sx={{
                        textTransform: 'none',
                        borderColor: 'var(--primary-green)',
                        color: 'var(--primary-green-dark)',
                        '&:hover': {
                          borderColor: 'var(--primary-green-dark)',
                          backgroundColor: 'var(--success-light)',
                        },
                      }}
                      onClick={() => openAddMoneyDialog(goal)}   // ✅ wired up
                    >
                      Add Money
                    </Button>

                    <IconButton size="small" onClick={() => console.log('Edit', goal.id)}>
                      <EditIcon fontSize="small" />
                    </IconButton>

                    <IconButton
                      size="small"
                      sx={{ color: 'var(--error)' }}
                      onClick={() => deleteGoal(goal.id)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </Box>
    </Container>
  );
}
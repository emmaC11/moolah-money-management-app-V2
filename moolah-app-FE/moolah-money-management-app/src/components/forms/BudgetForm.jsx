import { useState, useEffect } from 'react';
import { TextField, Button, Box, MenuItem, CircularProgress, Alert } from '@mui/material';
import { auth } from '../../firebase';

export default function BudgetForm({ onClose, onSuccess, initialData = null }) {
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    categoryId: '',
    currency: 'EUR',
    periodStart: '',
    periodEnd: '',
  });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        amount: initialData.amount || '',
        categoryId: initialData.categoryId || '',
        currency: initialData.currency || 'EUR',
        periodStart: initialData.periodStart || '',
        periodEnd: initialData.periodEnd || '',
      });
    }
  }, [initialData]);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const token = await user.getIdToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/categories?status=active`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to fetch categories');

      const data = await res.json();
      setCategories(data);
    } catch (err) {
      console.error('Error fetching categories:', err);
      setError('Failed to load categories');
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
      const url = initialData 
        ? `${import.meta.env.VITE_API_URL}/api/v1/budgets/${initialData.id}`
        : `${import.meta.env.VITE_API_URL}/api/v1/budgets`;
      
      const method = initialData ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save budget');
      }

      if (onSuccess) onSuccess();
      if (onClose) onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loadingCategories) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <TextField
          label="Budget Name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          fullWidth
        />

        <TextField
          label="Amount"
          name="amount"
          type="number"
          value={formData.amount}
          onChange={handleChange}
          required
          fullWidth
          inputProps={{ min: 0, step: 0.01 }}
        />

        <TextField
          label="Category"
          name="categoryId"
          select
          value={formData.categoryId}
          onChange={handleChange}
          required
          fullWidth
        >
          {categories.length === 0 ? (
            <MenuItem disabled>No categories available</MenuItem>
          ) : (
            categories.map((cat) => (
              <MenuItem key={cat.id} value={cat.id}>
                {cat.name}
              </MenuItem>
            ))
          )}
        </TextField>

        <TextField
          label="Currency"
          name="currency"
          select
          value={formData.currency}
          onChange={handleChange}
          fullWidth
        >
          <MenuItem value="EUR">EUR (€)</MenuItem>
          <MenuItem value="USD">USD ($)</MenuItem>
          <MenuItem value="GBP">GBP (£)</MenuItem>
        </TextField>

        <TextField
          label="Period Start"
          name="periodStart"
          type="date"
          value={formData.periodStart}
          onChange={handleChange}
          fullWidth
          InputLabelProps={{ shrink: true }}
        />

        <TextField
          label="Period End"
          name="periodEnd"
          type="date"
          value={formData.periodEnd}
          onChange={handleChange}
          fullWidth
          InputLabelProps={{ shrink: true }}
        />

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
          <Button 
            onClick={onClose} 
            variant="outlined"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            variant="contained"
            disabled={loading}
            sx={{ 
              backgroundColor: 'var(--primary-green)',
              '&:hover': {
                backgroundColor: 'var(--primary-green-dark)',
              }
            }}
          >
            {loading ? <CircularProgress size={24} /> : initialData ? 'Update Budget' : 'Create Budget'}
          </Button>
        </Box>
      </Box>
    </form>
  );
}

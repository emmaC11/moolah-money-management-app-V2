import { Typography, Container, Box, CssBaseline, Card, CardContent, Button, IconButton  } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useEffect, useState } from 'react';
import { auth } from '../firebase';

const colDef = [
  { field: 'name', headerName: 'Budget Name'},
  { field: 'categoryName', headerName: 'Category' },
  { field: 'amount', headerName: 'Income' },
  { field: 'spent', headerName: 'Expenses' },
  { field: 'remaining', headerName: 'Balance' },
  { field: 'createdAt', headerName: 'Created' },
];

export default function Budgets() {

  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getBudgets();
  }, []);

  const getBudgets = async () => {
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
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/budgets`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch budgets');
      }

      const data = await res.json();
      setBudgets(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }


  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header Section */}
        <Box>
          <Typography variant="h4" sx={{color: 'var(--primary-green-dark)', fontWeight: 700, mb: 1 }}>
            Budget Overview
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
            Manage and compare all your budgets
          </Typography>
        </Box>
        {/* todo: add budget button */}
        {/* Active Budget Card */}
        <Card sx={{ mb: 3, mt: 3, border: '1px solid var(--border)' }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box>
                <Typography variant="subtitle2" sx={{ color: 'var(--text-secondary)', mb: 0.5 }}>
                  Active Budget
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Budget Name Hardcoded
                </Typography>
              </Box>
            </Box>

            {/* Summary Cards */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
              {/* Income Card */}
              <Card sx={{ backgroundColor: '#DCFCE7', border: 'none', boxShadow: 'none' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                    <TrendingUpIcon sx={{ color: 'var(--primary-green)', fontSize: 20 }} />
                  </Box>
                  <Typography variant="h5" sx={{ textAlign: 'center', fontWeight: 600, color: 'var(--primary-green)' }}>
                    €6,500.00 hardcoded
                  </Typography>
                  <Typography variant="caption" sx={{ textAlign: 'center', display: 'block', color: 'var(--text-secondary)' }}>
                    Monthly Income
                  </Typography>
                </CardContent>
              </Card>

              {/* Expenses Card */}
              <Card sx={{ backgroundColor: '#FEE2E2', border: 'none', boxShadow: 'none' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                    <TrendingDownIcon sx={{ color: 'var(--error)', fontSize: 20 }} />
                  </Box>
                  <Typography variant="h5" sx={{ textAlign: 'center', fontWeight: 600, color: 'var(--error)' }}>
                    €0.00 hardcoded
                  </Typography>
                  <Typography variant="caption" sx={{ textAlign: 'center', display: 'block', color: 'var(--text-secondary)' }}>
                    Monthly Expenses
                  </Typography>
                </CardContent>
              </Card>

              {/* Balance Card */}
              <Card sx={{ backgroundColor: '#F3F4F6', border: 'none', boxShadow: 'none' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                    <AccountBalanceWalletIcon sx={{ color: 'var(--text-secondary)', fontSize: 20 }} />
                  </Box>
                  <Typography variant="h5" sx={{ textAlign: 'center', fontWeight: 600 }}>
                    €6,500.00 hardcoded
                  </Typography>
                  <Typography variant="caption" sx={{ textAlign: 'center', display: 'block', color: 'var(--text-secondary)' }}>
                    Net Balance
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          </CardContent>
        </Card>

        {/* Active Budget Section*/}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {budgets.map((budget) => (
          <Card key={budget.id} sx={{ border: '1px solid var(--border)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 2 }}>
                    {colDef.map((col) => (
                      <Box key={col.field}>
                        <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                          {col.headerName}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500, mt: 0.5 }}>
                          {budget[col.field] || 'N/A'}
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

    
  )
}
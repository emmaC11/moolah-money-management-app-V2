import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Container,
  Typography,
} from '@mui/material';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';

export default function ReviewProgress() {
  const [transactions, setTransactions] = useState([]);
  const [goals, setGoals] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      // Fetch each collection independently — same queries as Transactions/Goals/Budgets pages.
      // Separate try/catch per query so one failure doesn't blank the others.
      try {
        const txRef = collection(db, 'users', user.uid, 'transactions');
        const txSnap = await getDocs(query(txRef, orderBy('date', 'desc'), limit(200)));
        setTransactions(txSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error('ReviewProgress: transactions load failed:', e);
      }

      try {
        const goalsRef = collection(db, 'goals');
        const goalsSnap = await getDocs(
          query(goalsRef, where('userId', '==', user.uid), orderBy('deadline', 'asc'))
        );
        setGoals(goalsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error('ReviewProgress: goals load failed:', e);
      }

      try {
        const budgetsRef = collection(db, 'users', user.uid, 'budgets');
        const budgetsSnap = await getDocs(query(budgetsRef, orderBy('createdAt', 'desc')));
        setBudgets(budgetsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error('ReviewProgress: budgets load failed:', e);
      }

      setLoading(false);
    });

    return () => unsub();
  }, []);

  // ── Chart 1: Income vs Expenses by Month 
  const incomeExpenseChartOptions = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        label: d.toLocaleString('en-IE', { month: 'short', year: '2-digit' }),
      });
    }

    const incomeByBucket = {};
    const expenseByBucket = {};
    months.forEach(({ label }) => {
      incomeByBucket[label] = 0;
      expenseByBucket[label] = 0;
    });

    transactions.forEach((t) => {
      const dateObj =
        typeof t.date?.toDate === 'function' ? t.date.toDate() : new Date(t.date);
      const bucket = months.find(
        (m) => m.year === dateObj.getFullYear() && m.month === dateObj.getMonth()
      );
      if (!bucket) return;

      const amount = Number(t.amount) || 0;
      if (t.type === 'income') incomeByBucket[bucket.label] += amount;
      if (t.type === 'expense') expenseByBucket[bucket.label] += amount;
    });

    return {
      chart: { type: 'column', backgroundColor: 'transparent', height: 320 },
      title: { text: null },
      xAxis: { categories: months.map((m) => m.label), crosshair: true },
      yAxis: { min: 0, title: { text: 'Amount (€)' } },
      tooltip: { shared: true, valuePrefix: '€', valueDecimals: 2 },
      plotOptions: { column: { borderRadius: 4, groupPadding: 0.1 } },
      legend: { enabled: true },
      series: [
        {
          name: 'Income',
          data: months.map((m) =>
            parseFloat(incomeByBucket[m.label].toFixed(2))
          ),
          color: '#16A34A',
        },
        {
          name: 'Expenses',
          data: months.map((m) =>
            parseFloat(expenseByBucket[m.label].toFixed(2))
          ),
          color: '#DC2626',
        },
      ],
      credits: { enabled: false },
    };
  }, [transactions]);

  // ── Chart 2: Goals Progress 
  const goalsChartOptions = useMemo(() => {
    const categories = goals.map((g) => g.name || 'Unnamed');
    const savedSeries = goals.map((g) =>
      parseFloat(Number(g.current || 0).toFixed(2))
    );
    const remainingSeries = goals.map((g) => {
      const remaining = Number(g.target || 0) - Number(g.current || 0);
      return parseFloat(Math.max(0, remaining).toFixed(2));
    });

    return {
      chart: { type: 'bar', backgroundColor: 'transparent', height: Math.max(200, goals.length * 60 + 80) },
      title: { text: null },
      xAxis: { categories, title: { text: null } },
      yAxis: { min: 0, title: { text: 'Amount (€)' } },
      tooltip: { shared: true, valuePrefix: '€', valueDecimals: 2 },
      plotOptions: { bar: { stacking: 'normal', borderRadius: 4 } },
      legend: { enabled: true },
      series: [
        { name: 'Saved', data: savedSeries, color: '#16A34A' },
        { name: 'Remaining', data: remainingSeries, color: '#BFDBFE' },
      ],
      credits: { enabled: false },
    };
  }, [goals]);

  // ── Chart 3: Budget vs Actual Spending
  const budgetChartOptions = useMemo(() => {
    const expenseTransactions = transactions.filter((t) => t.type === 'expense');
    const categories = budgets.map((b) => b.name || b.categoryId || 'Unnamed');
    const budgetSeries = budgets.map((b) =>
      parseFloat(Number(b.amount || 0).toFixed(2))
    );
    const spentSeries = budgets.map((b) => {
      const spent = expenseTransactions
        .filter((t) => t.category === b.categoryId)
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);
      return parseFloat(spent.toFixed(2));
    });

    return {
      chart: { type: 'column', backgroundColor: 'transparent', height: 320 },
      title: { text: null },
      xAxis: { categories, crosshair: true },
      yAxis: { min: 0, title: { text: 'Amount (€)' } },
      tooltip: { shared: true, valuePrefix: '€', valueDecimals: 2 },
      plotOptions: { column: { borderRadius: 4, groupPadding: 0.1 } },
      legend: { enabled: true },
      series: [
        { name: 'Budget', data: budgetSeries, color: '#0369A1' },
        { name: 'Spent', data: spentSeries, color: '#DC2626' },
      ],
      credits: { enabled: false },
    };
  }, [budgets, transactions]);

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4, textAlign: 'center' }}>
        <Typography sx={{ mt: 2 }}>Loading progress data...</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Page Header */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h4"
          sx={{ color: 'var(--primary-green-dark)', fontWeight: 700, mb: 1 }}
        >
          Review Progress
        </Typography>
        <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
          See your progress, celebrate your wins, and adjust your strategy for
          continued success.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Chart 1: Income vs Expenses */}
        <Card sx={{ border: '1px solid var(--border)' }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
              Income vs Expenses
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 2 }}>
              Last 6 months
            </Typography>
            {transactions.length === 0 ? (
              <Typography
                variant="body2"
                sx={{ color: 'var(--text-muted)', py: 4, textAlign: 'center' }}
              >
                No transaction data yet.
              </Typography>
            ) : (
              <Box sx={{ overflowX: 'auto' }}>
                <HighchartsReact highcharts={Highcharts} options={incomeExpenseChartOptions} />
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Chart 2: Goals Progress */}
        <Card sx={{ border: '1px solid var(--border)' }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
              Goals Progress
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 2 }}>
              Saved vs remaining per goal
            </Typography>
            {goals.length === 0 ? (
              <Typography
                variant="body2"
                sx={{ color: 'var(--text-muted)', py: 4, textAlign: 'center' }}
              >
                No goals found. Create a goal to see progress here.
              </Typography>
            ) : (
              <Box sx={{ overflowX: 'auto' }}>
                <HighchartsReact highcharts={Highcharts} options={goalsChartOptions} />
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Chart 3: Budget vs Actual Spending */}
        <Card sx={{ border: '1px solid var(--border)' }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
              Budget vs Actual Spending
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 2 }}>
              How your spending compares to each budget
            </Typography>
            {budgets.length === 0 ? (
              <Typography
                variant="body2"
                sx={{ color: 'var(--text-muted)', py: 4, textAlign: 'center' }}
              >
                No budgets found. Create a budget to see spending here.
              </Typography>
            ) : (
              <Box sx={{ overflowX: 'auto' }}>
                <HighchartsReact highcharts={Highcharts} options={budgetChartOptions} />
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
}

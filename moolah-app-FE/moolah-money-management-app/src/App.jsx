// src/App.jsx
import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";

import Navbar from "./components/common/Navbar.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Transactions from "./pages/Transactions.jsx";
import Budgets from "./pages/Budgets.jsx";
import Goals from "./pages/Goals.jsx";
import ReviewProgress from "./pages/ReviewProgress.jsx";

import ThemeToggle from "./ThemeToggle.jsx";

// ⬇️ This matches the path shown in your current App.jsx
import Login from "./components/login/login.jsx";

// Firebase auth instance exported from src/firebase.js
import { auth } from "./firebase";

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Watch Firebase auth state (logged in / logged out)
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setChecking(false);
    });

    return () => unsub();
  }, []);

  if (checking) {
    // Optional: nicer loading UI
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm opacity-70">Loading…</p>
      </div>
    );
  }

  // Not logged in → show Login page only
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <h1 className="text-2xl font-bold mb-2">Moolah – Sign in</h1>
        <Login />
      </div>
    );
  }

  // Logged in → show app shell + routes
  return (
    <>
      <Navbar user={user} />

      {/* Put the theme toggle somewhere visible.
          You can move this into Navbar later if you prefer. */}
      <div className="px-4">
        <ThemeToggle />
      </div>

      <main className="px-4 py-4">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/budgets" element={<Budgets />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/progress" element={<ReviewProgress />} />

          {/* Catch-all: redirect unknown routes to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
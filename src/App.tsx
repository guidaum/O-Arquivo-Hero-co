/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import SessionJournal from './components/SessionJournal';
import Inventory from './components/Inventory';
import CharacterCreation from './components/CharacterCreation';
import CharacterSheet from './components/CharacterSheet';
import GMDashboard from './components/GMDashboard';
import AdminDashboard from './components/AdminDashboard';
import Login from './components/Login';
import { auth, onAuthStateChanged, User } from './firebase';
import { ThemeProvider } from './components/ThemeProvider';

export default function App() {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-obsidian flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-arcane/20 border-t-arcane rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="journal" element={<SessionJournal />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="create" element={<CharacterCreation />} />
            <Route path="sheet" element={<CharacterSheet />} />
            <Route path="gm/session/:sessionId" element={<GMDashboard />} />
            <Route path="admin" element={<AdminDashboard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

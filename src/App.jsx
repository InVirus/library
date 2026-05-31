import { Routes, Route, Navigate } from 'react-router-dom';

import LoginPage from './pages/LoginPage';
import BooksPage from './pages/BooksPage';
import ClientsPage from './pages/ClientsPage';
import AccountingPage from './pages/AccountingPage';
import UsersPage from './pages/UsersPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/books" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/books" element={<BooksPage />} />
      <Route path="/clients" element={<ClientsPage />} />
      <Route path="/accounting" element={<AccountingPage />} />
      <Route path="/users" element={<UsersPage />} />
    </Routes>
  );
}

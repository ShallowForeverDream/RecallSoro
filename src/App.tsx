import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { initDatabase } from './db';
import Layout from './components/Layout';
import { ToastProvider } from './components/common';
import Inbox from './pages/Inbox';
import Timeline from './pages/Timeline';
import { ExperienceDetail, Experiences } from './pages/Experiences';
import { CollectionDetail, Collections } from './pages/Collections';
import Search from './pages/Search';
import Settings from './pages/Settings';

export default function App() {
  useEffect(() => { void initDatabase(); }, []);
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Inbox />} />
            <Route path="/timeline" element={<Timeline />} />
            <Route path="/experiences" element={<Experiences />} />
            <Route path="/experiences/:id" element={<ExperienceDetail />} />
            <Route path="/collections" element={<Collections />} />
            <Route path="/collections/:id" element={<CollectionDetail />} />
            <Route path="/search" element={<Search />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}

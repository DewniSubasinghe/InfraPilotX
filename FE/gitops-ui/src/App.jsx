import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Documentation from './pages/Documentation';
import About from './pages/About';
import Contact from './pages/Contact';
import TilePage from './pages/Tilepage';
import GitHubPage from './pages/GitHubPage';
import ClusterPage from './pages/ClusterPage';
import AppManagementPage from './pages/AppManagementPage';
import CICDPage from './pages/CICDPage';
import MonitoringPage from './pages/MonitoringPage';
import MLPage from './pages/MLPage';

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/documentation" element={<Documentation />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/tile/:tileName" element={<TilePage />} />
        <Route path="/github" element={<GitHubPage />} />
        <Route path="/cluster" element={<ClusterPage />} />
        <Route path="/apps" element={<AppManagementPage />} />
        <Route path="/cicd" element={<CICDPage />} />
        <Route path="/monitoring" element={<MonitoringPage />} />
        <Route path="/ml" element={<MLPage />} />
      </Routes>
    </Router>
  );
};

export default App;

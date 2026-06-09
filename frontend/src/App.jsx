import React from 'react';
import SidebarLayout from './layouts/SidebarLayout';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <SidebarLayout>
      <Dashboard />
    </SidebarLayout>
  );
}

export default App;
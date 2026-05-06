import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { LineChart, TrendingUp, Activity } from 'lucide-react';
import Page1 from './pages/Page1';
import Page2 from './pages/Page2';
import Page3 from './pages/Page3';
import './index.css';

function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/', label: '大盤與櫃買', icon: <TrendingUp size={24} /> },
    { path: '/industry', label: '產業個股', icon: <LineChart size={24} /> },
    { path: '/top20', label: '成值排行', icon: <Activity size={24} /> },
  ];

  return (
    <nav className="sidebar">
      <div className="sidebar-header">
        <h1>台股動態</h1>
      </div>
      {navItems.map((item) => (
        <button
          key={item.path}
          className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
          onClick={() => navigate(item.path)}
        >
          <div className="nav-icon">{item.icon}</div>
          <span className="nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

function App() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data.json`)
      .then(res => res.json())
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching data:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="loading">載入資料中...</div>;
  }

  if (!data) {
    return <div className="loading">無法載入資料，請確認後端爬蟲是否正確執行。</div>;
  }

  return (
    <HashRouter>
      <div className="app-container">
        <Sidebar />
        
        <div className="main-wrapper">
          <header className="top-bar">
            <span className="last-updated">更新時間: {new Date(data.last_updated).toLocaleString('zh-TW')}</span>
          </header>
          
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Page1 data={data} />} />
              <Route path="/industry" element={<Page2 data={data} />} />
              <Route path="/top20" element={<Page3 data={data} />} />
            </Routes>
          </main>
        </div>
      </div>
    </HashRouter>
  );
}

export default App;

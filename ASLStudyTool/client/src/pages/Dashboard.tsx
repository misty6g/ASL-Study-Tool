import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { PracticeSession, PracticeStats } from '../types/ai';
import { apiClient } from '../api/client';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<PracticeStats | null>(null);
  const [history, setHistory] = useState<PracticeSession[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [historyPage, setHistoryPage] = useState(1);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }

    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Fetch Stats
        const statsRes = await apiClient.get<PracticeStats>('/api/practice/stats');
        setStats(statsRes.data);

        // 2. Fetch History for both list and graph (retrieve last 50 attempts)
        const historyRes = await apiClient.get<PracticeSession[]>(`/api/practice/history?page=1&limit=50`);
        const sessions = historyRes.data;
        setHistory(sessions);

        // 3. Format Chart Data (chronological order)
        const formattedChart = [...sessions]
          .reverse()
          .slice(-30) // last 30 sessions
          .map((session, idx) => ({
            attempt: idx + 1,
            score: Number(session.ai_score),
            sign: session.sign_attempted,
            date: new Date(session.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
          }));
        
        setChartData(formattedChart);
      } catch (err: any) {
        console.error('Failed to load dashboard data:', err);
        setError('Failed to fetch dashboard metrics. Please reload.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user, navigate]);

  const loadMoreHistory = async (nextPage: number) => {
    try {
      const historyRes = await apiClient.get<PracticeSession[]>(`/api/practice/history?page=${nextPage}&limit=10`);
      if (historyRes.data.length > 0) {
        setHistory(prev => [...prev, ...historyRes.data]);
        setHistoryPage(nextPage);
      }
    } catch (err) {
      console.error('Failed to load more sessions:', err);
    }
  };

  const getScoreColorClass = (score: number) => {
    if (score >= 80) return 'score-high';
    if (score >= 50) return 'score-medium';
    return 'score-low';
  };

  const toggleExpandSession = (id: string) => {
    setExpandedSessionId(prev => (prev === id ? null : id));
  };

  if (loading) {
    return (
      <div className="dashboard-loading-container">
        <div className="dashboard-spinner"></div>
        <p>Loading your progress analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error-container">
        <div className="error-box">
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Navigation Header */}
      <header className="dashboard-nav-header">
        <div className="nav-brand" onClick={() => navigate('/')}>
          <span className="brand-logo">🤟</span> ASL Study Tool
        </div>
        <div className="nav-actions">
          <button onClick={() => navigate('/')} className="nav-btn-home">Decks</button>
          <button onClick={logout} className="nav-btn-logout">Logout</button>
        </div>
      </header>

      {/* Hero Welcome banner */}
      <section className="dashboard-hero">
        <div className="hero-content">
          <h1>Welcome Back, student!</h1>
          <p>Monitor your gesture accuracy over time and refine your muscle memory with AI coaches.</p>
        </div>
        {stats && stats.streak_days > 0 && (
          <div className="streak-hero-card">
            <span className="streak-flame">🔥</span>
            <div className="streak-stats">
              <span className="streak-count">{stats.streak_days}</span>
              <span className="streak-label">Day Streak</span>
            </div>
          </div>
        )}
      </section>

      {/* Aggregate Stats Cards */}
      {stats && (
        <section className="dashboard-stats-grid">
          <div className="stats-card">
            <span className="stats-icon">🎯</span>
            <div className="stats-info">
              <h3>Average Score</h3>
              <p className="stats-value">{stats.average_score}%</p>
            </div>
          </div>

          <div className="stats-card">
            <span className="stats-icon">🚀</span>
            <div className="stats-info">
              <h3>Total Attempts</h3>
              <p className="stats-value">{stats.total_sessions}</p>
            </div>
          </div>

          <div className="stats-card">
            <span className="stats-icon">📈</span>
            <div className="stats-info">
              <h3>Most Practiced</h3>
              <p className="stats-value-text">{stats.most_practiced_sign}</p>
            </div>
          </div>

          <div className="stats-card">
            <span className="stats-icon">✨</span>
            <div className="stats-info">
              <h3>Most Improved</h3>
              <p className="stats-value-text">{stats.most_improved_sign}</p>
            </div>
          </div>
        </section>
      )}

      {/* Recharts chart block */}
      {chartData.length > 0 && (
        <section className="dashboard-chart-section">
          <div className="chart-header">
            <h3>Practice Accuracy (Last 30 Sessions)</h3>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" stroke="#64748b" tickLine={false} />
                <YAxis domain={[0, 100]} stroke="#64748b" tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    color: '#f8fafc'
                  }}
                  formatter={(value: any, name: any, props: any) => [`${value}% accuracy`, `Sign: "${props.payload.sign}"`]}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#6366f1"
                  strokeWidth={3}
                  activeDot={{ r: 8 }}
                  dot={{ r: 4, strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Expandable History Table */}
      <section className="dashboard-history-section">
        <div className="history-header">
          <h3>Practice Attempts Log</h3>
        </div>

        {history.length === 0 ? (
          <div className="history-empty-state">
            <p>You haven't practiced any signs yet. Start practicing to see logs!</p>
            <button onClick={() => navigate('/')}>Go to Decks</button>
          </div>
        ) : (
          <div className="history-list">
            {history.slice(0, historyPage * 10).map((session) => (
              <div 
                key={session.id} 
                className={`history-card-item ${expandedSessionId === session.id ? 'expanded' : ''}`}
                onClick={() => toggleExpandSession(session.id)}
              >
                <div className="history-item-summary">
                  <div className="item-meta">
                    <span className="item-sign">"{session.sign_attempted}"</span>
                    <span className="item-date">
                      {new Date(session.created_at).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <div className="item-score-badge-row">
                    <span className={`score-badge ${getScoreColorClass(Number(session.ai_score))}`}>
                      {Number(session.ai_score)}%
                    </span>
                    <span className="expand-chevron">
                      {expandedSessionId === session.id ? '▼' : '▶'}
                    </span>
                  </div>
                </div>

                {expandedSessionId === session.id && (
                  <div className="history-item-details" onClick={(e) => e.stopPropagation()}>
                    <div className="details-summary-box">
                      <strong>Coach Assessment:</strong>
                      <p>{session.ai_feedback}</p>
                    </div>
                    {session.improvement_areas && session.improvement_areas.length > 0 && (
                      <div className="details-tips">
                        <strong>Biomechanical Corrections:</strong>
                        <ul>
                          {session.improvement_areas.map((area, idx) => (
                            <li key={idx}>🔧 {area}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {history.length > historyPage * 10 && (
              <button 
                onClick={() => loadMoreHistory(historyPage + 1)} 
                className="history-load-more-btn"
              >
                Load Older Sessions
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default Dashboard;

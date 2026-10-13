import { useEffect, useState } from 'react';
import { api, flattenCategories } from './api.js';
import ChapterEditor from './ChapterEditor.jsx';
import QuestionEditor from './QuestionEditor.jsx';
import CatalogEditor from './CatalogEditor.jsx';

const MENU = [
  { id: 'grammar', label: '문법 챕터', number: '01' },
  { id: 'practical', label: '실무 챕터', number: '02' },
  { id: 'problems', label: '문제 영역', number: '03' },
  { id: 'catalog', label: '언어 · 주제', number: '04' },
];

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api('/api/auth/login', { method: 'POST', body: { email, password } });
      if (result.user?.role !== 'ADMIN') throw new Error('관리자 권한이 있는 계정으로 로그인해 주세요.');
      onLogin(result);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-screen">
    <div className="login-art" aria-hidden="true">
      <div className="login-art-top"><span className="mark">C</span> COBIA</div>
      <div className="login-art-copy"><span className="eyebrow light">CONTENT STUDIO</span><h1>배움의 흐름을<br />설계하는 공간.</h1><p>챕터부터 목차, 문제까지 한곳에서 관리하세요.</p></div>
      <div className="login-art-bottom">COBIA · ADMIN CONSOLE</div>
    </div>
    <div className="login-panel">
      <form className="login-form" onSubmit={submit}>
        <span className="eyebrow">ADMIN ACCESS</span>
        <h2>관리자 로그인</h2>
        <p className="muted">기존 COBIA 관리자 계정으로 로그인하세요.</p>
        <label>이메일<input type="email" value={email} autoComplete="username" onChange={e => setEmail(e.target.value)} required placeholder="name@example.com" /></label>
        <label>비밀번호<input type="password" value={password} autoComplete="current-password" onChange={e => setPassword(e.target.value)} required placeholder="비밀번호 입력" /></label>
        {error && <p className="alert error" role="alert">{error}</p>}
        <button className="button primary wide" disabled={busy}>{busy ? '로그인 중…' : '로그인'}</button>
        <p className="login-footnote">관리자 권한은 백엔드에서 확인합니다. 권한 변경 후에는 다시 로그인하세요.</p>
      </form>
    </div>
  </main>;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [view, setView] = useState('grammar');
  const [languages, setLanguages] = useState([]);
  const [categoryTree, setCategoryTree] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const token = session?.accessToken;

  const request = (path, options = {}) => api(path, { ...options, token });
  const categories = flattenCategories(categoryTree);
  const grammar = categories.find(category => category.code === 'GRAMMAR');
  const practical = categories.find(category => category.code === 'PRACTICAL');
  const problem = categories.find(category => category.code === 'CODING_PROBLEM');

  async function reloadAll() {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [nextLanguages, nextCategories, nextTemplates, nextQuestions] = await Promise.all([
        request('/api/languages?activeOnly=false'),
        request('/api/categories?activeOnly=false'),
        request('/api/templates?publishedOnly=false'),
        request('/api/questions?publishedOnly=false'),
      ]);
      setLanguages(nextLanguages);
      setCategoryTree(nextCategories);
      setTemplates(nextTemplates);
      setQuestions(nextQuestions);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setLoading(false);
    }
  }

  async function reloadContent() {
    const [nextTemplates, nextQuestions] = await Promise.all([
      request('/api/templates?publishedOnly=false'),
      request('/api/questions?publishedOnly=false'),
    ]);
    setTemplates(nextTemplates);
    setQuestions(nextQuestions);
  }

  async function reloadCatalog() {
    const [nextLanguages, nextCategories] = await Promise.all([
      request('/api/languages?activeOnly=false'),
      request('/api/categories?activeOnly=false'),
    ]);
    setLanguages(nextLanguages);
    setCategoryTree(nextCategories);
  }

  useEffect(() => { if (token) reloadAll(); }, [token]);

  async function logout() {
    try {
      await request('/api/auth/logout', { method: 'POST', body: { refreshToken: session.refreshToken } });
    } catch { /* Clear the local session even if the server is unavailable. */ }
    setSession(null);
  }

  if (!session) return <Login onLogin={setSession} />;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="mark">C</span><span><strong>COBIA</strong><small>CONTENT STUDIO</small></span></div>
      <div className="nav-caption">WORKSPACE</div>
      <nav aria-label="관리자 메뉴">
        {MENU.map(item => <button key={item.id} className={`nav-item ${view === item.id ? 'active' : ''}`} onClick={() => setView(item.id)}><span>{item.number}</span>{item.label}<b aria-hidden="true">›</b></button>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="user-box"><span className="avatar">{session.user?.nickname?.slice(0, 1) || 'A'}</span><span><strong>{session.user?.nickname || '관리자'}</strong><small>ADMIN</small></span></div>
        <button className="text-button" onClick={logout}>로그아웃 ↗</button>
      </div>
    </aside>
    <main className="main-area">
      <header className="topbar"><span>COBIA / 관리자 / {MENU.find(item => item.id === view)?.label}</span><span className="environment"><i /> LOCAL WORKSPACE</span></header>
      {error && <div className="alert error global-error" role="alert">{error} <button onClick={reloadAll}>다시 불러오기</button></div>}
      {loading && <div className="loading-line">콘텐츠를 불러오는 중…</div>}
      {view === 'grammar' && <ChapterEditor key="grammar" kind="grammar" rootCategory={grammar} categories={categories} languages={languages} templates={templates} questions={questions} request={request} reloadContent={reloadContent} />}
      {view === 'practical' && <ChapterEditor key="practical" kind="practical" rootCategory={practical} categories={categories} languages={languages} templates={templates} questions={questions} request={request} reloadContent={reloadContent} />}
      {view === 'problems' && <QuestionEditor key="standalone" mode="standalone" rootCategory={problem} categories={categories} languages={languages} questions={questions} request={request} reloadContent={reloadContent} />}
      {view === 'catalog' && <CatalogEditor languages={languages} categories={categories} practical={practical} request={request} reloadCatalog={reloadCatalog} />}
    </main>
  </div>;
}

import { useState } from 'react';

export default function CatalogEditor({ languages, categories, practical, request, reloadCatalog }) {
  const topics = categories.filter(category => category.parentId === practical?.id);
  const [tab, setTab] = useState('languages');
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState({ code: '', name: '', displayOrder: 1, active: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const isLanguage = tab === 'languages';
  const list = isLanguage ? languages : topics;

  function startNew(nextTab = tab) {
    const items = nextTab === 'languages' ? languages : topics;
    setTab(nextTab);
    setSelectedId(null);
    setForm({ code: '', name: '', displayOrder: Math.max(0, ...items.map(item => item.displayOrder)) + 1, active: true });
    setError('');
    setMessage('');
  }

  function edit(item) {
    setSelectedId(item.id);
    setForm({ code: item.code, name: item.name, displayOrder: item.displayOrder, active: item.active });
    setError('');
    setMessage('');
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const body = { ...form, code: form.code.trim().toUpperCase(), name: form.name.trim(), displayOrder: Number(form.displayOrder) };
      const base = isLanguage ? '/api/admin/languages' : '/api/admin/categories';
      if (selectedId) {
        await request(`${base}/${selectedId}`, { method: 'PUT', body });
      } else {
        if (!isLanguage) body.parentId = practical.id;
        const result = await request(base, { method: 'POST', body });
        setSelectedId(result.id);
      }
      await reloadCatalog();
      setMessage(isLanguage ? '언어를 저장했습니다.' : '실무 주제를 저장했습니다.');
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  }

  return <div className="page">
    <div className="page-heading"><div><span className="eyebrow">CATALOG MANAGEMENT</span><h1>언어 · 주제</h1><p>문법 화면의 언어와 실무 챕터의 주제 필터를 관리합니다.</p></div><button className="button primary" onClick={() => startNew()}>+ 새 {isLanguage ? '언어' : '주제'}</button></div>
    <div className="catalog-tabs"><button className={isLanguage ? 'active' : ''} onClick={() => startNew('languages')}>프로그래밍 언어</button><button className={!isLanguage ? 'active' : ''} onClick={() => startNew('topics')}>실무 주제</button></div>
    <div className="workspace-grid">
      <section className="catalog-list"><div className="list-heading"><strong>{isLanguage ? '언어 목록' : '실무 주제 목록'}</strong><span className="count">{list.length}</span></div>{list.map(item => <button key={item.id} className={`list-row ${selectedId === item.id ? 'selected' : ''}`} onClick={() => edit(item)}><span><strong>{item.name}</strong><small>{item.code} · {item.active ? '사용 중' : '숨김'}</small></span><b>›</b></button>)}</section>
      <form className="form-card" onSubmit={save}>
        <div className="form-title"><div><span className="eyebrow">{isLanguage ? 'LANGUAGE' : 'PRACTICAL TOPIC'}</span><h3>{selectedId ? '분류 수정' : '새 분류'}</h3></div></div>
        <div className="form-grid two"><label>표시 이름<input value={form.name} maxLength="50" onChange={e => setForm({ ...form, name: e.target.value })} required placeholder={isLanguage ? '예: Kotlin' : '예: 배포'} /></label><label>분류 코드<input value={form.code} maxLength={isLanguage ? 30 : 50} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} required placeholder={isLanguage ? 'KOTLIN' : 'PRACTICAL_DEPLOY'} /></label></div>
        <div className="form-grid two"><label>표시 순서<input type="number" min="1" value={form.displayOrder} onChange={e => setForm({ ...form, displayOrder: e.target.value })} required /></label><label>화면 표시<select value={String(form.active)} onChange={e => setForm({ ...form, active: e.target.value === 'true' })}><option value="true">표시</option><option value="false">숨김</option></select></label></div>
        <p className="info-box">숨김은 앱의 언어·주제 선택 목록에서 제외하는 설정입니다. 하단 메뉴 표시와는 관계없습니다.</p>
        {error && <p className="alert error" role="alert">{error}</p>}{message && <p className="alert success" role="status">{message}</p>}
        <div className="form-actions"><button className="button primary" disabled={busy}>{busy ? '저장 중…' : '분류 저장'}</button></div>
      </form>
    </div>
  </div>;
}

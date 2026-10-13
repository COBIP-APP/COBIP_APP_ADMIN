import { useEffect, useState } from 'react';
import { flattenSections } from './api.js';
import QuestionEditor from './QuestionEditor.jsx';

const EMPTY_SECTION = { parentSectionId: null, title: '', body: '', exampleCode: '', displayOrder: 1 };

function SectionEditor({ chapter, request, onChanged }) {
  const sections = flattenSections(chapter.sections || []);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(EMPTY_SECTION);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function nextOrder(parentId) {
    return Math.max(0, ...sections.filter(item => item.parentId === parentId).map(item => item.displayOrder)) + 1;
  }

  function startNew() {
    setSelectedId(null);
    setForm({ ...EMPTY_SECTION, displayOrder: nextOrder(null) });
    setMessage('');
    setError('');
  }

  function edit(item) {
    setSelectedId(item.id);
    setForm({ parentSectionId: item.parentId, title: item.title, body: item.body || '', exampleCode: item.exampleCode || '', displayOrder: item.displayOrder });
    setMessage('');
    setError('');
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const body = { ...form, displayOrder: Number(form.displayOrder), parentSectionId: form.parentSectionId ? Number(form.parentSectionId) : null };
      if (selectedId) {
        await request(`/api/admin/templates/${chapter.id}/sections/${selectedId}`, { method: 'PUT', body: { title: body.title, body: body.body, exampleCode: body.exampleCode, displayOrder: body.displayOrder } });
      } else {
        const result = await request(`/api/admin/templates/${chapter.id}/sections`, { method: 'POST', body });
        setSelectedId(result.id);
      }
      await onChanged();
      setMessage('목차를 저장했습니다.');
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  }

  return <div className="editor-split">
    <div className="item-list">
      <div className="list-heading"><strong>목차</strong><button className="button small secondary" onClick={startNew}>+ 추가</button></div>
      {sections.length === 0 && <p className="empty-small">목차가 없습니다. 1-1부터 추가해 보세요.</p>}
      {sections.map(item => <button key={item.id} className={`list-row ${selectedId === item.id ? 'selected' : ''}`} style={{ paddingLeft: `${16 + item.depth * 17}px` }} onClick={() => edit(item)}><span><strong>{item.title}</strong><small>순서 {item.displayOrder}{item.body ? ' · 학습 내용 있음' : ''}</small></span><b>›</b></button>)}
    </div>
    <form className="form-card" onSubmit={save}>
      <div className="form-title"><div><span className="eyebrow">SECTION EDITOR</span><h3>{selectedId ? '목차 수정' : '새 목차'}</h3></div><span className="form-hint">학습 화면의 한 단계</span></div>
      <div className="form-grid two">
        <label>상위 목차<select value={form.parentSectionId ?? ''} disabled={Boolean(selectedId)} onChange={e => setForm({ ...form, parentSectionId: e.target.value ? Number(e.target.value) : null, displayOrder: nextOrder(e.target.value ? Number(e.target.value) : null) })}><option value="">없음 · 최상위</option>{sections.map(item => <option key={item.id} value={item.id}>{'— '.repeat(item.depth)}{item.title}</option>)}</select></label>
        <label>표시 순서<input type="number" min="1" value={form.displayOrder} onChange={e => setForm({ ...form, displayOrder: e.target.value })} required /></label>
      </div>
      <label>목차 제목<input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} maxLength="150" required placeholder="예: 1-1. 조건식 이해하기" /></label>
      <label>학습 본문<textarea rows="8" value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} placeholder="설명 글을 입력하세요. 줄바꿈은 앱에서도 유지됩니다." /></label>
      <label>예제 코드 <em>선택</em><textarea className="code-input" rows="7" value={form.exampleCode} onChange={e => setForm({ ...form, exampleCode: e.target.value })} placeholder={'int score = 65;\nif (score > 60) {\n  System.out.println("합격");\n}'} /></label>
      {error && <p className="alert error" role="alert">{error}</p>}
      {message && <p className="alert success" role="status">{message}</p>}
      <div className="form-actions"><button className="button primary" disabled={busy}>{busy ? '저장 중…' : selectedId ? '변경 저장' : '목차 저장'}</button></div>
    </form>
  </div>;
}

export default function ChapterEditor({ kind, rootCategory, categories, languages, templates, questions, request, reloadContent }) {
  const isGrammar = kind === 'grammar';
  const practicalTopics = categories.filter(category => category.parentId === rootCategory?.id);
  const list = templates.filter(template => isGrammar ? template.categoryId === rootCategory?.id : practicalTopics.some(category => category.id === template.categoryId));
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [tab, setTab] = useState('summary');
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [form, setForm] = useState({ categoryId: null, languageId: null, title: '', summary: '', description: '', difficulty: 'EASY', displayOrder: 1 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function nextOrder(categoryId, languageId) {
    return Math.max(0, ...templates.filter(item => item.categoryId === categoryId && item.languageId === languageId).map(item => item.displayOrder)) + 1;
  }

  function newForm() {
    const categoryId = isGrammar ? rootCategory?.id : practicalTopics[0]?.id;
    const languageId = isGrammar ? languages[0]?.id : null;
    setSelectedId(null);
    setDetail(null);
    setSelectedSectionId(null);
    setTab('summary');
    setForm({ categoryId: categoryId ?? null, languageId: languageId ?? null, title: '', summary: '', description: '', difficulty: 'EASY', displayOrder: nextOrder(categoryId, languageId ?? null) });
    setError('');
    setMessage('');
  }

  useEffect(() => {
    if (!rootCategory || selectedId || form.categoryId) return;
    const categoryId = isGrammar ? rootCategory.id : practicalTopics[0]?.id;
    setForm(current => ({ ...current, categoryId: categoryId ?? null, languageId: isGrammar ? (languages[0]?.id ?? null) : null, displayOrder: nextOrder(categoryId, isGrammar ? (languages[0]?.id ?? null) : null) }));
  }, [rootCategory?.id, languages.length, categories.length]);

  async function loadDetail(id) {
    const result = await request(`/api/templates/${id}?publishedOnly=false`);
    setDetail(result);
    return result;
  }

  async function selectTemplate(item) {
    setSelectedId(item.id);
    setSelectedSectionId(null);
    setTab('summary');
    setError('');
    setMessage('');
    setDetail(null);
    try {
      const result = await loadDetail(item.id);
      setForm({ categoryId: result.categoryId, languageId: result.languageId, title: result.title, summary: result.summary, description: result.description, difficulty: result.difficulty, displayOrder: result.displayOrder });
    } catch (caught) {
      setError(caught.message);
    }
  }

  async function saveTemplate(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (!form.categoryId || (isGrammar && !form.languageId)) throw new Error('언어 또는 주제를 먼저 선택해 주세요.');
      const body = { ...form, categoryId: Number(form.categoryId), languageId: form.languageId ? Number(form.languageId) : null, displayOrder: Number(form.displayOrder) };
      if (selectedId) {
        await request(`/api/admin/templates/${selectedId}`, { method: 'PUT', body });
        await loadDetail(selectedId);
      } else {
        const result = await request('/api/admin/templates', { method: 'POST', body });
        setSelectedId(result.id);
        await loadDetail(result.id);
      }
      await reloadContent();
      setMessage(detail?.published ? '공개 중인 챕터의 변경 사항을 저장했습니다.' : '챕터를 비공개 초안으로 저장했습니다. 공개 버튼을 누르면 앱에 표시됩니다.');
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  }

  async function togglePublished() {
    if (!detail) return;
    setBusy(true);
    setError('');
    try {
      await request(`/api/admin/templates/${detail.id}/publication`, { method: 'PATCH', body: { published: !detail.published } });
      await loadDetail(detail.id);
      await reloadContent();
      setMessage(detail.published ? '챕터를 비공개로 전환했습니다.' : '챕터를 공개했습니다.');
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  }

  if (!rootCategory) return <div className="page"><p className="alert error">분류 정보를 불러오지 못했습니다. 백엔드 연결을 확인해 주세요.</p></div>;

  const sections = flattenSections(detail?.sections || []);
  const section = sections.find(item => item.id === selectedSectionId);

  return <div className="page">
    <div className="page-heading"><div><span className="eyebrow">CONTENT MANAGEMENT / {isGrammar ? 'GRAMMAR' : 'PRACTICAL'}</span><h1>{isGrammar ? '문법 챕터' : '실무 챕터'}</h1><p>{isGrammar ? '언어별 학습 챕터, 목차와 문제를 관리합니다.' : '캐시·DB·네트워크 등 실무 주제별 학습 콘텐츠를 관리합니다.'}</p></div><button className="button primary" onClick={newForm}>+ 새 챕터</button></div>
    <div className="workspace-grid">
      <section className="catalog-list"><div className="list-heading"><strong>챕터 목록</strong><span className="count">{list.length}</span></div>{list.length === 0 && <p className="empty-small">아직 등록한 챕터가 없습니다.</p>}{list.map(item => <button key={item.id} className={`chapter-row ${selectedId === item.id ? 'selected' : ''}`} onClick={() => selectTemplate(item)}><span className="chapter-icon">{isGrammar ? '</>' : '▦'}</span><span><strong>{item.title}</strong><small>{isGrammar ? item.languageName : item.categoryName} · {item.difficulty}</small></span><span className={`status ${item.published ? 'published' : ''}`}>{item.published ? '공개' : '초안'}</span></button>)}</section>
      <section className="work-panel">
        <div className="panel-top"><div><span className="eyebrow">{selectedId ? `CHAPTER #${selectedId}` : 'NEW CHAPTER'}</span><h2>{selectedId ? (detail?.title || '불러오는 중…') : '새 챕터 만들기'}</h2></div>{detail && <span className={`status large ${detail.published ? 'published' : ''}`}>{detail.published ? '● 공개 중' : '○ 비공개 초안'}</span>}</div>
        <div className="tabs"><button className={tab === 'summary' ? 'active' : ''} onClick={() => setTab('summary')}>기본 정보</button><button className={tab === 'sections' ? 'active' : ''} disabled={!selectedId} onClick={() => setTab('sections')}>목차 · 학습 내용 <span>{sections.length}</span></button><button className={tab === 'questions' ? 'active' : ''} disabled={!selectedId} onClick={() => setTab('questions')}>목차별 문제 <span>{questions.filter(q => q.relatedTemplateId === selectedId).length}</span></button></div>
        {tab === 'summary' && <form className="form-card" onSubmit={saveTemplate}>
          <div className="form-grid two">
            {isGrammar ? <label>학습 언어<select value={form.languageId ?? ''} onChange={e => { const languageId = Number(e.target.value); setForm({ ...form, languageId, displayOrder: nextOrder(rootCategory.id, languageId) }); }} required><option value="">선택하세요</option>{languages.map(language => <option key={language.id} value={language.id}>{language.name}{language.active ? '' : ' · 숨김'}</option>)}</select></label> : <label>실무 주제<select value={form.categoryId ?? ''} onChange={e => { const categoryId = Number(e.target.value); setForm({ ...form, categoryId, displayOrder: nextOrder(categoryId, null) }); }} required><option value="">선택하세요</option>{practicalTopics.map(category => <option key={category.id} value={category.id}>{category.name}{category.active ? '' : ' · 숨김'}</option>)}</select></label>}
            <label>난이도<select value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })}><option value="EASY">초급</option><option value="NORMAL">중급</option><option value="HARD">고급</option></select></label>
          </div>
          <label>챕터 제목<input maxLength="100" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required placeholder={isGrammar ? '예: Java 조건문 기초' : '예: 캐시 관리와 Redis 활용'} /></label>
          <label>목록 소개<input maxLength="300" value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} required placeholder="앱의 챕터 카드에 표시됩니다." /></label>
          <label>챕터 설명<textarea rows="5" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required placeholder="챕터 전체를 소개하는 설명입니다. 실제 1-1 학습 내용은 목차 탭에서 입력하세요." /></label>
          <label className="narrow-field">표시 순서<input type="number" min="1" value={form.displayOrder} onChange={e => setForm({ ...form, displayOrder: e.target.value })} required /></label>
          {error && <p className="alert error" role="alert">{error}</p>}{message && <p className="alert success" role="status">{message}</p>}
          <div className="form-actions"><button className="button primary" disabled={busy}>{busy ? '처리 중…' : selectedId ? '변경 저장' : '챕터 저장'}</button>{detail && <button className="button secondary" type="button" disabled={busy} onClick={togglePublished}>{detail.published ? '비공개로 전환' : '챕터 공개'}</button>}</div>
        </form>}
        {tab === 'sections' && detail && <SectionEditor key={detail.id} chapter={detail} request={request} onChanged={() => loadDetail(detail.id)} />}
        {tab === 'questions' && detail && <div className="questions-in-chapter"><div className="section-picker"><label>문제를 연결할 목차<select value={selectedSectionId ?? ''} onChange={e => setSelectedSectionId(e.target.value ? Number(e.target.value) : null)}><option value="">목차를 선택하세요</option>{sections.map(item => <option key={item.id} value={item.id}>{'— '.repeat(item.depth)}{item.title}</option>)}</select></label><p>1-1을 고르면 해당 학습 뒤에 나올 문제를 등록할 수 있습니다.</p></div>{section ? <QuestionEditor key={section.id} mode="section" rootCategory={rootCategory} categories={categories} languages={languages} questions={questions} request={request} reloadContent={reloadContent} chapter={detail} section={section} /> : <div className="empty-state">목차를 선택하면 연결된 문제가 여기에 표시됩니다.</div>}</div>}
      </section>
    </div>
  </div>;
}

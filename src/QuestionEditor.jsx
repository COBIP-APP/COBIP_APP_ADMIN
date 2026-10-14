import { useState } from 'react';

const TYPES = [
  ['MULTIPLE_CHOICE', '객관식'],
  ['OX', 'O / X'],
  ['CODE_WRITING', '코드 작성'],
  ['CODE_EXPLANATION', '코드 해석'],
  ['SHORT_ANSWER', '단답형'],
  ['FILL_BLANK', '빈칸형'],
  ['DESCRIPTIVE', '서술형'],
];

function defaultForm({ chapter, section, rootCategory, languages, questions }) {
  const categoryId = chapter?.categoryId ?? rootCategory?.id ?? null;
  const languageId = chapter?.languageId ?? null;
  const relatedSectionId = section?.id ?? null;
  const displayOrder = Math.max(0, ...questions.filter(question => question.relatedSectionId === relatedSectionId && (relatedSectionId || question.categoryId === categoryId)).map(question => question.displayOrder)) + 1;
  return {
    categoryId, languageId: languageId || (chapter ? null : (languages[0]?.id ?? null)),
    relatedTemplateId: chapter?.id ?? null, relatedSectionId,
    questionType: 'MULTIPLE_CHOICE', prompt: '', codeSnippet: '',
    options: ['', '', '', ''], correctChoiceKey: '1', referenceAnswer: '',
    gradingCriteria: '', explanation: '', difficulty: 'EASY', passScore: 70, displayOrder,
  };
}

function fromApi(question) {
  return {
    categoryId: question.categoryId, languageId: question.languageId,
    relatedTemplateId: question.relatedTemplateId, relatedSectionId: question.relatedSectionId,
    questionType: question.questionType, prompt: question.prompt,
    codeSnippet: question.codeSnippet || '',
    options: question.questionType === 'OX' ? ['O', 'X'] : (question.choiceOptions || []).map(option => option.text),
    correctChoiceKey: question.correctChoiceKey || '1', referenceAnswer: question.referenceAnswer || '',
    gradingCriteria: Array.isArray(question.gradingCriteria) ? question.gradingCriteria.join('\n') : '',
    explanation: question.explanation || '', difficulty: question.difficulty,
    passScore: question.passScore, displayOrder: question.displayOrder,
  };
}

export default function QuestionEditor({ mode, rootCategory, languages, questions, request, reloadContent, chapter, section }) {
  const isStandalone = mode === 'standalone';
  const list = questions.filter(question => isStandalone
    ? question.categoryId === rootCategory?.id && question.relatedTemplateId == null && !question.userSaved
    : question.relatedSectionId === section?.id)
    .sort((a, b) => isStandalone
      ? (b.createdAt || '').localeCompare(a.createdAt || '') || b.id - a.id
      : a.displayOrder - b.displayOrder || a.id - b.id);
  const [selectedId, setSelectedId] = useState(null);
  const [published, setPublished] = useState(false);
  const [form, setForm] = useState(() => defaultForm({ chapter, section, rootCategory, languages, questions }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const isChoice = form.questionType === 'MULTIPLE_CHOICE' || form.questionType === 'OX';

  function startNew() {
    setSelectedId(null);
    setPublished(false);
    setForm(defaultForm({ chapter, section, rootCategory, languages, questions }));
    setError('');
    setMessage('');
  }

  async function edit(item) {
    setError('');
    setMessage('');
    try {
      const result = await request(`/api/admin/questions/${item.id}`);
      setSelectedId(item.id);
      setPublished(result.published);
      setForm(fromApi(result));
    } catch (caught) {
      setError(caught.message);
    }
  }

  function changeType(type) {
    setForm({ ...form, questionType: type,
      options: type === 'OX' ? ['O', 'X'] : type === 'MULTIPLE_CHOICE' ? ['', '', '', ''] : [],
      correctChoiceKey: '1' });
  }

  function payload() {
    if (!form.categoryId) throw new Error('문제 분류를 불러오지 못했습니다.');
    const options = isChoice ? form.options.map((text, index) => ({ key: form.questionType === 'OX' ? ['O', 'X'][index] : String(index + 1), text: text.trim() })) : null;
    if (isChoice && (!options.every(option => option.text) || !options.some(option => option.key === form.correctChoiceKey))) {
      throw new Error('보기를 모두 입력하고 정답을 선택해 주세요.');
    }
    if (!isChoice && !form.referenceAnswer.trim()) throw new Error('모범 답안 또는 예상 출력을 입력해 주세요.');
    if (form.questionType === 'CODE_EXPLANATION' && !form.codeSnippet.trim()) throw new Error('코드 해석 문제에는 제시 코드를 입력해 주세요.');
    if (form.questionType === 'CODE_WRITING' && languages.find(language => language.id === Number(form.languageId))?.code !== 'JAVA') {
      throw new Error('현재 코드 작성형은 Java만 채점할 수 있습니다. Java를 선택해 주세요.');
    }
    return {
      categoryId: Number(form.categoryId),
      relatedTemplateId: form.relatedTemplateId ? Number(form.relatedTemplateId) : null,
      relatedSectionId: form.relatedSectionId ? Number(form.relatedSectionId) : null,
      languageId: form.languageId ? Number(form.languageId) : null,
      questionType: form.questionType, prompt: form.prompt.trim(),
      codeSnippet: form.codeSnippet.trim() || null, choiceOptions: options,
      correctChoiceKey: isChoice ? form.correctChoiceKey : null,
      referenceAnswer: isChoice ? null : form.referenceAnswer.trim(),
      gradingCriteria: form.gradingCriteria.trim() ? form.gradingCriteria.split('\n').map(line => line.trim()).filter(Boolean) : null,
      explanation: form.explanation.trim() || null,
      difficulty: form.difficulty, passScore: Number(form.passScore), displayOrder: Number(form.displayOrder),
    };
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const body = payload();
      if (selectedId) {
        await request(`/api/admin/questions/${selectedId}`, { method: 'PUT', body });
      } else {
        const result = await request('/api/admin/questions', { method: 'POST', body });
        setSelectedId(result.id);
      }
      await reloadContent();
      setMessage(published ? '공개 중인 문제의 변경 사항을 저장했습니다.' : '문제를 비공개 초안으로 저장했습니다. 정답을 확인한 뒤 공개하세요.');
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  }

  async function togglePublished() {
    if (!selectedId) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await request(`/api/admin/questions/${selectedId}/publication`, { method: 'PATCH', body: { published: !published } });
      setPublished(!published);
      await reloadContent();
      setMessage(published ? '문제를 비공개로 전환했습니다.' : '문제를 공개했습니다.');
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!selectedId || !window.confirm('이 문제를 삭제할까요? 기존 제출 기록은 보관됩니다.')) return;
    setBusy(true);
    setError('');
    try {
      await request(`/api/admin/questions/${selectedId}`, { method: 'DELETE' });
      await reloadContent();
      startNew();
      setMessage('문제를 삭제했습니다.');
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  }

  if (!rootCategory) return <div className="empty-state">문제 분류를 불러오지 못했습니다.</div>;

  return <div className={isStandalone ? 'page' : ''}>
    {isStandalone && <div className="page-heading"><div><span className="eyebrow">QUESTION BANK / INDEPENDENT</span><h1>문제 영역</h1><p>앱 하단 메뉴의 문제 화면에 보여줄 독립 문제를 관리합니다.</p></div><button className="button primary" onClick={startNew}>+ 새 문제</button></div>}
    <div className={isStandalone ? 'workspace-grid' : 'editor-split'}>
      <section className={isStandalone ? 'catalog-list' : 'item-list'}><div className="list-heading"><strong>{isStandalone ? '문제 목록' : `${section.title} 문제`}</strong><button className="button small secondary" onClick={startNew}>+ 추가</button></div>{list.length === 0 && <p className="empty-small">등록한 문제가 없습니다.</p>}{list.map(item => <button key={item.id} className={`list-row ${selectedId === item.id ? 'selected' : ''}`} onClick={() => edit(item)}><span><strong>{item.prompt}</strong><small>{TYPES.find(([key]) => key === item.questionType)?.[1] || item.questionType} · {item.difficulty} · {item.published ? '공개' : '초안'}</small></span><b>›</b></button>)}</section>
      <form className="form-card" onSubmit={save}>
        <div className="form-title"><div><span className="eyebrow">QUESTION EDITOR {selectedId ? `#${selectedId}` : ''}</span><h3>{selectedId ? '문제 수정' : '새 문제'}</h3></div><span className={`status ${published ? 'published' : ''}`}>{selectedId ? published ? '공개' : '초안' : '새 초안'}</span></div>
        <div className="form-grid three">
          <label>유형<select value={form.questionType} onChange={e => changeType(e.target.value)}>{TYPES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label>난이도<select value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })}><option value="EASY">초급</option><option value="NORMAL">중급</option><option value="HARD">고급</option></select></label>
          <label>표시 순서<input type="number" min="1" value={form.displayOrder} onChange={e => setForm({ ...form, displayOrder: e.target.value })} required /></label>
        </div>
        <div className="form-grid two">
          {isStandalone && <label>언어 <em>선택</em><select value={form.languageId ?? ''} onChange={e => setForm({ ...form, languageId: e.target.value ? Number(e.target.value) : null })}><option value="">언어 없음</option>{languages.map(language => <option key={language.id} value={language.id}>{language.name}</option>)}</select></label>}
          <label>합격 점수<input type="number" min="0" max="100" value={form.passScore} onChange={e => setForm({ ...form, passScore: e.target.value })} required /></label>
        </div>
        <label>문제 지문<textarea rows="4" value={form.prompt} onChange={e => setForm({ ...form, prompt: e.target.value })} required placeholder="사용자에게 보여줄 문제를 입력하세요." /></label>
        {(form.questionType === 'CODE_EXPLANATION' || form.questionType === 'CODE_WRITING') && <label>{form.questionType === 'CODE_EXPLANATION' ? '해석할 코드' : '시작 코드'} <em>{form.questionType === 'CODE_WRITING' ? '선택' : ''}</em><textarea className="code-input" rows="6" value={form.codeSnippet} onChange={e => setForm({ ...form, codeSnippet: e.target.value })} placeholder="코드를 입력하세요." /></label>}
        {isChoice ? <div className="choices"><div className="field-title">보기와 정답 <span>정답을 왼쪽 원으로 선택</span></div>{form.options.map((option, index) => { const key = form.questionType === 'OX' ? ['O', 'X'][index] : String(index + 1); return <label className="choice-row" key={key}><input type="radio" name="correctChoice" checked={form.correctChoiceKey === key} onChange={() => setForm({ ...form, correctChoiceKey: key })} /><span>{key}</span><input value={option} disabled={form.questionType === 'OX'} onChange={e => setForm({ ...form, options: form.options.map((value, i) => i === index ? e.target.value : value) })} placeholder={`${key}번 보기`} required /></label>; })}</div> : <label>{form.questionType === 'CODE_EXPLANATION' ? '예상 출력 · 정답' : '모범 답안'}<textarea rows="4" className={form.questionType === 'CODE_WRITING' ? 'code-input' : ''} value={form.referenceAnswer} onChange={e => setForm({ ...form, referenceAnswer: e.target.value })} required placeholder="채점할 정답 또는 모범 답안을 입력하세요." /></label>}
        {(form.questionType === 'CODE_WRITING' || form.questionType === 'DESCRIPTIVE') && <label>평가 기준 <em>선택 · 한 줄에 하나씩</em><textarea rows="4" value={form.gradingCriteria} onChange={e => setForm({ ...form, gradingCriteria: e.target.value })} placeholder={'예: if 조건문을 사용한다\n60보다 큰 값을 비교한다'} /></label>}
        <label>정답 해설 <em>선택</em><textarea rows="3" value={form.explanation} onChange={e => setForm({ ...form, explanation: e.target.value })} placeholder="답을 제출한 뒤 보여줄 해설입니다." /></label>
        {form.questionType === 'CODE_WRITING' && <p className="info-box">현재 코드 작성형 AI 채점은 Java만 지원합니다. Java 언어를 선택했는지 확인하세요.</p>}
        {error && <p className="alert error" role="alert">{error}</p>}{message && <p className="alert success" role="status">{message}</p>}
        <div className="form-actions"><button className="button primary" disabled={busy}>{busy ? '처리 중…' : selectedId ? '변경 저장' : '문제 저장'}</button>{selectedId && <button className="button secondary" type="button" disabled={busy} onClick={togglePublished}>{published ? '비공개로 전환' : '문제 공개'}</button>}{selectedId && <button className="button secondary" type="button" disabled={busy} onClick={remove}>문제 삭제</button>}</div>
      </form>
    </div>
  </div>;
}

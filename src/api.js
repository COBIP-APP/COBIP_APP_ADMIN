export async function api(path, { token, method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new Error('서버에 연결할 수 없습니다. 백엔드와 개발 서버를 확인해 주세요.');
  }

  if (response.ok) return response.status === 204 ? null : response.json();

  const raw = await response.text();
  let result;
  try { result = JSON.parse(raw); } catch { /* Some server errors are plain text. */ }
  const field = result?.fieldErrors && Object.entries(result.fieldErrors)[0];
  const fieldNames = { categoryId: '실무 주제', languageId: '학습 언어', title: '챕터 제목', summary: '목록 소개', description: '챕터 설명', difficulty: '난이도', displayOrder: '표시 순서', code: '분류 코드', name: '표시 이름' };
  const message = field
    ? `${fieldNames[field[0]] || field[0]}: ${field[1]}`
    : result?.message || result?.detail || (raw && !raw.trimStart().startsWith('<') ? raw.slice(0, 200) : null);
  throw new Error(typeof message === 'string' ? message : `요청 실패 (HTTP ${response.status})`);
}

export function flattenSections(sections, depth = 0) {
  return sections.flatMap(section => [
    { ...section, depth },
    ...flattenSections(section.children || [], depth + 1),
  ]);
}

export function flattenCategories(categories) {
  return categories.flatMap(category => [category, ...flattenCategories(category.children || [])]);
}

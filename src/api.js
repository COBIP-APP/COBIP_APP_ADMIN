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

  const result = await response.json().catch(() => null);
  const field = result?.fieldErrors && Object.entries(result.fieldErrors)[0];
  const message = field ? `${field[0]}: ${field[1]}` : result?.message || result?.detail;
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

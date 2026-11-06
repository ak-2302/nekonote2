const API_BASE_URL = 'https://nekonote.xn--n8jl2g.xn--q9jyb4c/api';
const TASK_API_URL = `${API_BASE_URL}/app/tasks`;
const CONNECTION_REQUIRED_MESSAGE = '接続が必要です。オンラインで再試行してください。';

function apiError(message, status) {
    const error = new Error(message);
    error.status = status;
    return error;
}

async function fetchFromNetwork(url, options = {}) {
    if (!navigator.onLine) throw apiError(CONNECTION_REQUIRED_MESSAGE);

    try {
        return await fetch(url, { ...options, cache: 'no-store' });
    } catch {
        throw apiError(CONNECTION_REQUIRED_MESSAGE);
    }
}

function authHeaders() {
    const token = localStorage.getItem('access_token');
    if (!token) throw new Error('ログインが必要です');
    return { Authorization: `Bearer ${token}` };
}

async function getTasks() {
    const response = await fetchFromNetwork(TASK_API_URL, { headers: authHeaders() });
    if (!response.ok) throw apiError(`タスクAPI: ${response.status}`, response.status);
    return (await response.json()).tasks;
}

async function getTask(taskId) {
    const response = await fetchFromNetwork(`${API_BASE_URL}/dev/tasks/${encodeURIComponent(taskId)}`);
    if (response.status === 404) return null;
    if (!response.ok) throw apiError(`タスクAPI: ${response.status}`, response.status);
    return (await response.json()).task;
}

async function saveTask(task) {
    const response = await fetchFromNetwork(TASK_API_URL, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(task)
    });
    if (!response.ok) throw apiError(`タスクAPI: ${response.status}`, response.status);
    return (await response.json()).task;
}

async function login(username, password) {
    const response = await fetchFromNetwork(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const payload = await response.json();
    if (!response.ok) throw apiError(payload.error?.message || 'ログインに失敗しました', response.status);
    localStorage.setItem('access_token', payload.access_token);
    return payload.user;
}

async function registerUser(username, password) {
    const response = await fetchFromNetwork(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: username, username, password })
    });
    const payload = await response.json();
    if (!response.ok) throw apiError(payload.error?.message || 'アカウント登録に失敗しました', response.status);
    return login(username, password);
}

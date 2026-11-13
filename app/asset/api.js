const API_BASE_URL = '/api';
const TASK_API_URL = `${API_BASE_URL}/app/tasks`;
const CONNECTION_REQUIRED_MESSAGE = '接続が必要です。オンラインで再試行してください。';
const SERVER_UNREACHABLE_MESSAGE = 'サーバーに接続できません。しばらくしてから再試行してください。';

function apiError(message, status, kind) {
    const error = new Error(message);
    error.status = status;
    error.kind = kind;
    return error;
}

async function fetchFromNetwork(url, options = {}) {
    if (!navigator.onLine) throw apiError(CONNECTION_REQUIRED_MESSAGE, undefined, 'offline');

    try {
        return await fetch(url, { ...options, cache: 'no-store' });
    } catch {
        throw apiError(SERVER_UNREACHABLE_MESSAGE, undefined, 'network');
    }
}

function authHeaders() {
    const token = localStorage.getItem('access_token');
    if (!token) throw apiError('ログインが必要です', 401);
    return { Authorization: `Bearer ${token}` };
}

async function getTasks() {
    const response = await fetchFromNetwork(TASK_API_URL, { headers: authHeaders() });
    if (!response.ok) throw apiError(`タスクAPI: ${response.status}`, response.status);
    return (await response.json()).tasks;
}

async function getTask(taskId) {
    const response = await fetchFromNetwork(`${TASK_API_URL}/${encodeURIComponent(taskId)}`, {
        headers: authHeaders()
    });
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

async function updateTaskDone(taskId, done) {
    const response = await fetchFromNetwork(`${TASK_API_URL}/${encodeURIComponent(taskId)}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ done })
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

async function getPushPublicKey() {
    const response = await fetchFromNetwork(`${API_BASE_URL}/push/public-key`);
    if (!response.ok) throw apiError(`通知API: ${response.status}`, response.status);
    return (await response.json()).public_key;
}

async function sendPushSubscription(subscription) {
    const response = await fetchFromNetwork(`${API_BASE_URL}/push/subscribe`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON())
    });
    if (!response.ok) throw apiError(`通知API: ${response.status}`, response.status);
}

async function removePushSubscription(endpoint) {
    const response = await fetchFromNetwork(`${API_BASE_URL}/push/unsubscribe`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint })
    });
    if (!response.ok) throw apiError(`通知API: ${response.status}`, response.status);
}

const API_BASE_URL = 'https://nekonote.xn--n8jl2g.xn--q9jyb4c/api';
const TASK_API_URL = `${API_BASE_URL}/app/tasks`;

function authHeaders() {
    const token = localStorage.getItem('access_token');
    if (!token) throw new Error('ログインが必要です');
    return { Authorization: `Bearer ${token}` };
}

async function getTasks() {
    const response = await fetch(TASK_API_URL, { cache: 'no-store', headers: authHeaders() });
    if (!response.ok) throw new Error(`タスクAPI: ${response.status}`);
    return (await response.json()).tasks;
}

async function getTask(taskId) {
    const tasks = await getTasks();
    return tasks.find(task => task.id === taskId) || null;
}

async function saveTask(task) {
    const response = await fetch(TASK_API_URL, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(task)
    });
    if (!response.ok) throw new Error(`タスクAPI: ${response.status}`);
    return (await response.json()).task;
}

async function login(username, password) {
    const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message || 'ログインに失敗しました');
    localStorage.setItem('access_token', payload.access_token);
    return payload.user;
}

async function registerUser(username, password) {
    const response = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: username, username, password })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message || 'アカウント登録に失敗しました');
    return login(username, password);
}

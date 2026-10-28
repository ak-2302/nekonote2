const TASK_DATABASE = 'nekonote2';
const TASK_STORE = 'tasks';

const FALLBACK_DEMO_DATA = {
    tasks: [
        {
            id: '550e8400-e29b-41d4-a716-446655440001',
            name: '授業資料を確認する',
            description: '今日の講義資料を読み、重要な箇所をメモする',
            start: 1793160648,
            end: 1793460648,
            done: false
        },
        {
            id: '550e8400-e29b-41d4-a716-446655440002',
            name: 'チームの議事録を整理する',
            description: '前回のミーティング内容を共有用にまとめる',
            start: 1793419200,
            end: 1793422800,
            done: false
        },
        {
            id: '550e8400-e29b-41d4-a716-446655440003',
            name: 'タイマー画面を確認する',
            description: 'タスクからタイマーへ遷移できることを確認する',
            start: 1793516400,
            end: 1793520000,
            done: true
        },
        {
            id: '550e8400-e29b-41d4-a716-446655440004',
            name: '現在時刻の動作確認',
            description: '現在時刻を基準にタイマーの経過を確認する',
            start: 1793160188,
            end: 1793160368,
            done: false
        }
    ]
};

function openTaskDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(TASK_DATABASE, 1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore(TASK_STORE, { keyPath: 'id' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function readTasks(database) {
    return new Promise((resolve, reject) => {
        const request = database.transaction(TASK_STORE, 'readonly')
            .objectStore(TASK_STORE)
            .getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function writeTasks(database, tasks) {
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(TASK_STORE, 'readwrite');
        tasks.forEach(task => transaction.objectStore(TASK_STORE).put(task));
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
    });
}

async function loadDemoData() {
    try {
        const response = await fetch('../demodata.json', { cache: 'no-store' });
        if (!response.ok) throw new Error(`demodata.json: ${response.status}`);
        return response.json();
    } catch (error) {
        console.warn('demodata.jsonを読み込めないため、組み込みデータを使用します。', error);
        return FALLBACK_DEMO_DATA;
    }
}

async function initializeTaskDatabase() {
    const database = await openTaskDatabase();
    const tasks = await readTasks(database);
    const migratedTasks = tasks.map(normalizeTask);
    const demoTasks = (await loadDemoData()).tasks;
    const existingIds = new Set(migratedTasks.map(task => task.id));
    const missingDemoTasks = demoTasks.filter(task => !existingIds.has(task.id));
    if (migratedTasks.some((task, index) => task !== tasks[index]) || missingDemoTasks.length) {
        await writeTasks(database, [...migratedTasks, ...missingDemoTasks]);
    }
    return database;
}

function normalizeTask(task) {
    if (typeof task.start === 'number' && typeof task.end === 'number' && typeof task.done === 'boolean') {
        return task;
    }
    const start = Math.floor(new Date(`${task.date}T${task.time}`).getTime() / 1000);
    return {
        id: task.id,
        name: task.name,
        description: task.description || '',
        start,
        end: start + 3600,
        done: task.status === 'done'
    };
}

async function getTasks() {
    const database = await initializeTaskDatabase();
    return readTasks(database);
}

async function getTask(taskId) {
    const tasks = await getTasks();
    return tasks.find(task => task.id === taskId) || null;
}

async function saveTask(task) {
    const database = await initializeTaskDatabase();
    return writeTasks(database, [task]);
}

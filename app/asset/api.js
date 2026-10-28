const TASK_API_URL = 'https://nekonote.xn--n8jl2g.xn--q9jyb4c/api/dev/tasks';

async function getTasks() {
    const response = await fetch(TASK_API_URL, { cache: 'no-store' });
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task)
    });
    if (!response.ok) throw new Error(`タスクAPI: ${response.status}`);
    return (await response.json()).task;
}

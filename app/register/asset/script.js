const add_btn = document.getElementById('add-btn');
const open_register_btn = document.getElementById('open_register');
const close_register_btn = document.getElementById('close_register');
const modal_backdrop = document.getElementById('modal_backdrop');
const task_count = document.getElementById('task_count');
const empty_state = document.getElementById('empty_state');
const next_task = document.getElementById('next_task');
const next_task_time = document.getElementById('next_task_time');
const next_task_name = document.getElementById('next_task_name');
const next_task_date = document.getElementById('next_task_date');
const toast = document.getElementById('toast');
const toast_message = document.getElementById('toast_message');
const task_time = document.getElementById('task_time');
const task_duration = document.getElementById('task_duration');
const task_name = document.getElementById('task_name');
const task_list = document.getElementById('task_list');
let toast_timer;
let expiry_timer;
let tasks = [];

open_register_btn.addEventListener('click', () => {
    modal_backdrop.hidden = false;
    task_name.focus();
});

close_register_btn.addEventListener('click', () => {
    modal_backdrop.hidden = true;
});

modal_backdrop.addEventListener('click', (event) => {
    if (event.target === modal_backdrop) modal_backdrop.hidden = true;
});

add_btn.addEventListener('click', async () => {
    const time = task_time.value;
    const name = task_name.value.trim();
    const date = document.getElementById('task_date').value;
    const durationMinutes = Number(task_duration.value);

    if (!name || !date || !time || !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
        const missing = !name ? 'タスク名' : !date ? '日付' : !time ? '時間' : '所要時間';
        showToast(`${missing}を入力してください`);
        document.getElementById(!name ? 'task_name' : !date ? 'task_date' : !time ? 'task_time' : 'task_duration').focus();
        return;
    }

    const start = Math.floor(new Date(`${date}T${time}`).getTime() / 1000);
    const task = {
        id: crypto.randomUUID(),
        name,
        description: '',
        start,
        end: start + durationMinutes * 60,
        done: false
    };
    await saveTask(task);
    tasks = await getTasks();
    renderTasks();
    task_time.value = '';
    task_duration.value = '';
    task_name.value = '';
    document.getElementById('task_date').value = '';
    modal_backdrop.hidden = true;
});

function renderTasks() {
    const now = Date.now();
    const activeTasks = tasks.filter(task => task.end * 1000 > now);
    clearTimeout(expiry_timer);
    task_list.innerHTML = '';
    empty_state.hidden = activeTasks.length > 0;
    task_count.textContent = `${activeTasks.length}件`;
    if (!activeTasks.length) {
        next_task.hidden = true;
        task_list.appendChild(empty_state);
        return;
    }

    activeTasks.sort((a, b) => a.start - b.start);
    const nextTask = activeTasks[0];
    next_task.hidden = false;
    next_task_time.textContent = formatTime(nextTask.start);
    next_task_name.textContent = nextTask.name;
    next_task_date.textContent = formatDate(nextTask.start);

    activeTasks.forEach(task => {
        const li = document.createElement('li');
        li.className = 'task-item';
        li.innerHTML = `
            <span class="task-time">${formatTime(task.start)}</span>
            <span class="task-info">
                <span class="task-name"></span>
                <span class="task-date">${formatDate(task.start)}</span>
                <span class="task-duration">所要時間：${formatDuration(task.end - task.start)}</span>
            </span>
            <a class="start-timer-button" href="../timer/index.html?${new URLSearchParams({ task: task.id })}">
                タイマーを開始
            </a>
        `;
        li.querySelector('.task-name').textContent = task.name;
        task_list.appendChild(li);
    });

    const nextExpiry = Math.min(...activeTasks.map(task => task.end * 1000));
    expiry_timer = setTimeout(renderTasks, Math.max(0, nextExpiry - Date.now() + 10));
}

function formatDate(unixSeconds) {
    return new Date(unixSeconds * 1000).toLocaleDateString('ja-JP', {
        month: 'numeric',
        day: 'numeric',
        weekday: 'short'
    });
}

function formatTime(unixSeconds) {
    return new Date(unixSeconds * 1000).toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

function formatDuration(durationSeconds) {
    const minutes = Math.round(durationSeconds / 60);
    if (minutes < 60) return `${minutes}分`;
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder ? `${hours}時間${remainder}分` : `${hours}時間`;
}

function showToast(message) {
    clearTimeout(toast_timer);
    toast_message.textContent = message;
    toast.hidden = false;
    toast_timer = setTimeout(() => {
        toast.hidden = true;
    }, 3000);
}

getTasks().then((storedTasks) => {
    tasks = storedTasks;
    renderTasks();
}).catch(() => showToast('タスクを読み込めませんでした'));

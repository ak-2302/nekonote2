
const register_container = document.getElementById('register_container');
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
let toast_timer;

// 登録モーダルを表示する
open_register_btn.addEventListener('click', () => {
    modal_backdrop.hidden = false;
    task_name.focus();
});

// 登録モーダルを非表示にする
close_register_btn.addEventListener('click', () => {
    modal_backdrop.hidden = true;
});

modal_backdrop.addEventListener('click', (event) => {
    if (event.target === modal_backdrop) modal_backdrop.hidden = true;
});


const task_time = document.getElementById('task_time');
const task_name = document.getElementById('task_name');
const task_list = document.getElementById('task_list');

let tasks = [];


// 「登録」ボタンが押されたときの処理
add_btn.addEventListener('click', () => {
    const time = task_time.value;
    const name = task_name.value.trim();
    const date = document.getElementById('task_date').value;

    if (!name || !date || !time) {
        const missing = !name ? 'タスク名' : !date ? '日付' : '時間';
        showToast(`${missing}を入力してください`);
        document.getElementById(!name ? 'task_name' : !date ? 'task_date' : 'task_time').focus();
        return;
    }

    // 配列にタスクを追加し、時間順にソート
    tasks.push({ date, time, name });
    tasks.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

    // 一覧の再描画と入力欄のクリア
    renderTasks();
    task_time.value = '';
    task_name.value = '';
    document.getElementById('task_date').value = '';
    modal_backdrop.hidden = true;
});

// タスク一覧を画面に描画する関数
function renderTasks() {
    task_list.innerHTML = '';
    empty_state.hidden = tasks.length > 0;
    task_count.textContent = `${tasks.length}件`;
    if (!tasks.length) {
        next_task.hidden = true;
        task_list.appendChild(empty_state);
        return;
    }

    const now = new Date();
    const upcomingTasks = tasks.filter(task => new Date(`${task.date}T${task.time}`) >= now);
    const nextTask = upcomingTasks[0] || tasks[tasks.length - 1];
    next_task.hidden = false;
    next_task_time.textContent = nextTask.time;
    next_task_name.textContent = nextTask.name;
    next_task_date.textContent = formatDate(nextTask.date);

    tasks.forEach(task => {
        const li = document.createElement('li');
        li.className = 'task-item';
        const dateLabel = formatDate(task.date);
        const timerQuery = new URLSearchParams({ task: task.name });
        li.innerHTML = `
            <span class="task-time">${task.time}</span>
            <span class="task-info">
                <span class="task-name"></span>
                <span class="task-date">${dateLabel}</span>
            </span>
            <a class="start-timer-button" href="../timer/?${timerQuery}">
                タイマーを開始
            </a>
        `;
        li.querySelector('.task-name').textContent = task.name;
        task_list.appendChild(li);
    });
}

function formatDate(date) {
    return new Date(`${date}T00:00:00`).toLocaleDateString('ja-JP', {
        month: 'numeric',
        day: 'numeric',
        weekday: 'short'
    });
}

function showToast(message) {
    clearTimeout(toast_timer);
    toast_message.textContent = message;
    toast.hidden = false;
    toast_timer = setTimeout(() => {
        toast.hidden = true;
    }, 3000);
}

renderTasks();

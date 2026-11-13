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
const task_description = document.getElementById('task_description');
const task_list = document.getElementById('task_list');
const open_login_btn = document.getElementById('open_login');
const close_login_btn = document.getElementById('close_login');
const login_backdrop = document.getElementById('login_backdrop');
const login_form = document.getElementById('login_form');
const login_error = document.getElementById('login_error');
const task_notify_before = document.getElementById('task_notify_before');
const push_prompt = document.getElementById('push_prompt');
const push_prompt_text = document.getElementById('push_prompt_text');
const enable_push_btn = document.getElementById('enable_push');
const task_date = document.getElementById('task_date');
const MINUTE_STEP = 1; // ダイヤルの分の刻み
const time_wheel = createTimeWheel({
    hourElement: document.getElementById('wheel_hour'),
    minuteElement: document.getElementById('wheel_minute'),
    input: task_time,
    minuteStep: MINUTE_STEP
});
const empty_state_content = empty_state.innerHTML;
let toast_timer;
let expiry_timer;
let tasks = [];

// 通知の状態に応じて「通知を有効にする」欄を出し分ける
async function refreshPushPrompt() {
    if (!localStorage.getItem('access_token')) {
        push_prompt.hidden = true;
        return;
    }
    if (!isPushSupported()) {
        push_prompt_text.textContent = '通知を受け取るには、ホーム画面に追加したアプリから開いてください。';
        enable_push_btn.hidden = true;
        push_prompt.hidden = false;
        return;
    }
    if (Notification.permission === 'denied') {
        push_prompt_text.textContent = '通知がブロックされています。端末の設定から許可してください。';
        enable_push_btn.hidden = true;
        push_prompt.hidden = false;
        return;
    }
    if (Notification.permission === 'granted') {
        // 許可済みなら、この端末をログイン中のユーザーの通知先として登録し直す
        try {
            await syncPushSubscription();
            push_prompt.hidden = true;
            return;
        } catch (error) {
            console.warn('通知の登録に失敗しました', error);
        }
    }
    push_prompt_text.textContent = 'タスクの開始時刻に通知を受け取れます。';
    enable_push_btn.hidden = false;
    push_prompt.hidden = false;
}

enable_push_btn.addEventListener('click', async () => {
    enable_push_btn.disabled = true;
    try {
        await enablePushNotifications();
        push_prompt.hidden = true;
        showToast('通知を有効にしました');
    } catch (error) {
        showToast(error.message);
        refreshPushPrompt();
    } finally {
        enable_push_btn.disabled = false;
    }
});

function showLoggedOut() {
    push_prompt.hidden = true;
    tasks = [];
    clearTimeout(expiry_timer);
    next_task.hidden = true;
    task_list.innerHTML = '';
    task_count.textContent = 'ログインしてください';
    document.getElementById('auth_prompt').hidden = false;
    open_register_btn.hidden = true;
    open_login_btn.textContent = 'ログイン';
    login_backdrop.hidden = false;
    document.getElementById('login_username').focus();
}

async function showLoggedIn() {
    document.getElementById('auth_prompt').hidden = true;
    open_register_btn.hidden = false;
    open_login_btn.textContent = 'ログアウト';
    tasks = await getTasks();
    renderTasks();
    refreshPushPrompt();
}

function showTaskLoadError(message) {
    tasks = [];
    clearTimeout(expiry_timer);
    next_task.hidden = true;
    task_list.innerHTML = '';
    empty_state.innerHTML = '<p></p><span></span>';
    empty_state.querySelector('p').textContent = message;
    empty_state.querySelector('span').textContent = '状態を確認してから再試行してください';
    empty_state.hidden = false;
    task_list.appendChild(empty_state);
    task_count.textContent = 'タスクを取得できません';
}

open_login_btn.addEventListener('click', () => {
    if (localStorage.getItem('access_token')) {
        // トークンを消す前に、この端末への通知を止める（失敗してもログアウトは続ける）
        disablePushForCurrentUser()
            .catch((error) => console.warn('通知の解除に失敗しました', error))
            .finally(() => {
                localStorage.removeItem('access_token');
                showLoggedOut();
            });
        return;
    }
    login_backdrop.hidden = false;
    document.getElementById('login_username').focus();
});

close_login_btn.addEventListener('click', () => {
    login_backdrop.hidden = true;
});

login_backdrop.addEventListener('click', (event) => {
    if (event.target === login_backdrop) login_backdrop.hidden = true;
});

login_form.addEventListener('submit', async (event) => {
    event.preventDefault();
    login_error.hidden = true;
    try {
        const username = document.getElementById('login_username').value.trim();
        const password = document.getElementById('login_password').value;
        try {
            await login(username, password);
        } catch (error) {
            if (!error.message.includes('正しくありません')) throw error;
            await registerUser(username, password);
        }
        login_backdrop.hidden = true;
        // タイマー画面から未ログインで来た場合は、元のタスクへ戻す
        const pendingTask = new URLSearchParams(location.search).get('task');
        if (pendingTask) {
            location.replace(`../timer/index.html?${new URLSearchParams({ task: pendingTask })}`);
            return;
        }
        await showLoggedIn();
        showToast('ログインしました');
    } catch (error) {
        login_error.textContent = error.message;
        login_error.hidden = false;
    }
});

// 次の刻みの時刻（例：15:24 → 15:25）。日付をまたぐ場合もあるのでDateで返す
function nextTimeSlot() {
    const stepMs = MINUTE_STEP * 60 * 1000;
    const now = new Date();
    now.setSeconds(0, 0);
    return new Date(Math.ceil(now.getTime() / stepMs) * stepMs);
}

function toDateInputValue(date) {
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

open_register_btn.addEventListener('click', () => {
    modal_backdrop.hidden = false;
    // 未入力なら、日付と時刻を「次の刻みの時刻」で埋めておく（ダイヤルは表示後でないと位置を設定できない）
    if (!task_time.value) {
        const slot = nextTimeSlot();
        if (!task_date.value) task_date.value = toDateInputValue(slot);
        time_wheel.set(slot.getHours(), slot.getMinutes());
    }
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
    const description = task_description.value.trim();
    const date = document.getElementById('task_date').value;
    const durationMinutes = Number(task_duration.value);

    if (!name || !date || !time || !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
        const missing = !name ? 'タスク名' : !date ? '日付' : !time ? '時間' : '所要時間';
        showToast(`${missing}を入力してください`);
        document.getElementById(!name ? 'task_name' : !date ? 'task_date' : !time ? 'wheel_hour' : 'task_duration').focus();
        return;
    }

    const start = Math.floor(new Date(`${date}T${time}`).getTime() / 1000);
    const task = {
        id: crypto.randomUUID(),
        name,
        description,
        start,
        end: start + durationMinutes * 60,
        done: false,
        notify_before: task_notify_before.checked ? 5 : 0
    };
    try {
        await saveTask(task);
        await showLoggedIn();
    } catch (error) {
        showToast(error.message);
        return;
    }
    task_time.value = '';
    task_duration.value = '';
    task_name.value = '';
    task_description.value = '';
    task_notify_before.checked = false;
    document.getElementById('task_date').value = '';
    modal_backdrop.hidden = true;
});

function renderTasks() {
    const now = Date.now();
    // 完了済みは表示から外すだけで、データは残す（後で記録機能に使う）
    const activeTasks = tasks.filter(task => !task.done && task.end * 1000 > now);
    clearTimeout(expiry_timer);
    task_list.innerHTML = '';
    empty_state.innerHTML = empty_state_content;
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

if (localStorage.getItem('access_token')) {
    showLoggedIn().catch((error) => {
        if (error.status === 401) {
            localStorage.removeItem('access_token');
            showLoggedOut();
            return;
        }
        showTaskLoadError(error.message);
    });
} else {
    showLoggedOut();
}

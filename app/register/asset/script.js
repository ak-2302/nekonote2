const add_btn = document.getElementById('add-btn');
const open_register_btn = document.getElementById('open_register');
const close_register_btn = document.getElementById('close_register');
const task_count = document.getElementById('task_count');
const empty_state = document.getElementById('empty_state');
const next_task = document.getElementById('next_task');
const next_task_time = document.getElementById('next_task_time');
const next_task_name = document.getElementById('next_task_name');
const next_task_date = document.getElementById('next_task_date');
const toast = document.getElementById('toast');
const toast_message = document.getElementById('toast_message');
const toast_icon = document.getElementById('toast_icon');
const task_description = document.getElementById('task_description');
const task_list = document.getElementById('task_list');
const open_login_btn = document.getElementById('open_login');
const close_login_btn = document.getElementById('close_login');
const login_backdrop = document.getElementById('login_backdrop');
const login_form = document.getElementById('login_form');
const login_error = document.getElementById('login_error');
const push_prompt = document.getElementById('push_prompt');
const push_prompt_text = document.getElementById('push_prompt_text');
const enable_push_btn = document.getElementById('enable_push');
const sheet_backdrop = document.getElementById('sheet_backdrop');
const sheet = document.getElementById('sheet');
const sheet_top = document.getElementById('sheet_top');
const step_title = document.getElementById('step_title');
const step_progress = document.getElementById('step_progress');
const steps_element = document.getElementById('steps');
const step_elements = [...steps_element.querySelectorAll('.step')];
const template_chips = document.getElementById('template_chips');
const new_task_box = document.getElementById('new_task_box');
const new_task_input = document.getElementById('new_task_input');
const toggle_edit_btn = document.getElementById('toggle_edit');
const date_chips = document.getElementById('date_chips');
const date_other_box = document.getElementById('date_other_box');
const date_other_input = document.getElementById('date_other_input');
const time_note = document.getElementById('time_note');
const duration_chips = document.getElementById('duration_chips');
const duration_other_box = document.getElementById('duration_other_box');
const duration_other_input = document.getElementById('duration_other_input');
const summary = document.getElementById('summary');
const summary_note = document.getElementById('summary_note');
const notify_before_btn = document.getElementById('notify_before');
const description_details = document.getElementById('description_details');
const MINUTE_STEP = 1; // ダイヤルの分の刻み
const STEP_LABELS = ['タスク', '日付', '開始', '時間', '確認'];
const LAST_STEP = STEP_LABELS.length - 1;
const DURATION_OPTIONS = [5, 10, 15, 20, 30, 45, 60];
const SHEET_CLOSE_DRAG_PX = 100;  // ハンドルをこれ以上下にドラッグしたら閉じる
const SHEET_TRANSITION_MS = 320;  // style.css の .sheet の transition と合わせる
// 登録シートで入力中の値。各ステップの表示はここから描画する
let draft = emptyDraft();
const time_wheel = createTimeWheel({
    hourElement: document.getElementById('wheel_hour'),
    minuteElement: document.getElementById('wheel_minute'),
    minuteStep: MINUTE_STEP,
    onChange: (hour, minute) => {
        draft.time = [hour, minute];
        renderTimeNote();
        renderSummary();
    }
});
const empty_state_content = empty_state.innerHTML;
let toast_timer;
let expiry_timer;
let tasks = [];
let current_user = null;
let current_step = 0;
let editing_templates = false;
let saving_task = false;
let sheet_close_timer;

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
        showToast('通知を有効にしました', 'success');
    } catch (error) {
        showToast(error.message);
        refreshPushPrompt();
    } finally {
        enable_push_btn.disabled = false;
    }
});

function showLoggedOut() {
    push_prompt.hidden = true;
    closeSheet();
    tasks = [];
    current_user = null;
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
    // ユーザー情報はテンプレートの保存先を分けるためだけに使うので、取れなくてもタスクは表示する
    const [loadedTasks, user] = await Promise.all([
        getTasks(),
        getCurrentUser().catch(() => null)
    ]);
    tasks = loadedTasks;
    current_user = user;
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
        showToast('ログインしました', 'success');
    } catch (error) {
        login_error.textContent = error.message;
        login_error.hidden = false;
    }
});

// ===== タスク登録シート =====

const pad2 = (value) => String(value).padStart(2, '0');

function emptyDraft() {
    return {
        name: null,
        date: null,            // 選んだ日付（その日の0時のDate）
        time: null,            // [時, 分]。ダイヤルの値
        timeConfirmed: false,  // 開始時刻のステップで「次へ」を押したか、通り過ぎたか
        duration: null,        // 分
        notify: false,         // 5分前に通知するか
        description: ''
    };
}

// 今日から days 日後の0時
function dayOffset(days) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + days);
    return date;
}

// 次の刻みの時刻（例：15:24 → 15:25）。日付をまたぐ場合もあるのでDateで返す
function nextTimeSlot() {
    const stepMs = MINUTE_STEP * 60 * 1000;
    const now = new Date();
    now.setSeconds(0, 0);
    return new Date(Math.ceil(now.getTime() / stepMs) * stepMs);
}

function toDateInputValue(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

// 「11/21(土)」の形
function formatShortDate(date) {
    return date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' });
}

// 「今日」「明日」「明後日」。それ以外は空文字
function relativeDayLabel(date) {
    const diff = Math.round((date - dayOffset(0)) / 86400000);
    return ['今日', '明日', '明後日'][diff] || '';
}

function draftStart() {
    if (!draft.date || !draft.time) return null;
    const start = new Date(draft.date);
    start.setHours(draft.time[0], draft.time[1], 0, 0);
    return start;
}

function isStepComplete(step) {
    switch (step) {
        case 0: return Boolean(draft.name);
        case 1: return Boolean(draft.date);
        case 2: return draft.timeConfirmed;
        case 3: return Boolean(draft.duration);
        default: return false;
    }
}

// --- テンプレート（タスク名の候補） ---
// 過去のタスク名に、この端末で手動で追加・削除したものを反映する。手動の分はユーザーごとに localStorage に保存する

function templateStorageKey() {
    return current_user ? `torikakari:templates:${current_user.user_id}` : null;
}

function loadTemplateEdits() {
    const key = templateStorageKey();
    try {
        const saved = key ? JSON.parse(localStorage.getItem(key)) : null;
        return {
            added: Array.isArray(saved?.added) ? saved.added : [],
            removed: Array.isArray(saved?.removed) ? saved.removed : []
        };
    } catch {
        return { added: [], removed: [] };
    }
}

function saveTemplateEdits(edits) {
    const key = templateStorageKey();
    if (!key) return;
    try {
        localStorage.setItem(key, JSON.stringify(edits));
    } catch (error) {
        console.warn('テンプレートを保存できませんでした', error);
    }
}

// 最近使ったものが先
function templateNames() {
    const { added, removed } = loadTemplateEdits();
    const fromHistory = [...tasks].sort((a, b) => b.start - a.start).map(task => task.name);
    return [...new Set([...fromHistory, ...added])].filter(name => !removed.includes(name));
}

function addTemplate(name) {
    const edits = loadTemplateEdits();
    edits.removed = edits.removed.filter(item => item !== name);
    if (!edits.added.includes(name)) edits.added.unshift(name);
    saveTemplateEdits(edits);
}

function removeTemplate(name) {
    const edits = loadTemplateEdits();
    edits.added = edits.added.filter(item => item !== name);
    if (!edits.removed.includes(name)) edits.removed.push(name);
    saveTemplateEdits(edits);
    if (draft.name === name) draft.name = null;
    renderSheet();
}

// 同じ名前のタスクを最後に登録したとき（start が最新）の設定
function lastSettings(name) {
    const last = tasks
        .filter(task => task.name === name)
        .sort((a, b) => b.start - a.start)[0];
    if (!last) return null;
    return {
        start: new Date(last.start * 1000),
        duration: Math.round((last.end - last.start) / 60),
        notify: last.notify_before === 5,
        description: last.description || ''
    };
}

// --- 描画 ---

function chipButton(className, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.addEventListener('click', onClick);
    return button;
}

function renderTemplates() {
    template_chips.innerHTML = '';
    template_chips.classList.toggle('editing', editing_templates);

    if (!editing_templates) {
        const add = chipButton('chip add', () => {
            new_task_box.hidden = false;
            new_task_input.focus();
        });
        add.textContent = '＋ 新しいタスク';
        template_chips.appendChild(add);
    }

    templateNames().forEach(name => {
        const last = lastSettings(name);
        const chip = chipButton(
            `chip template${draft.name === name ? ' is-selected' : ''}`,
            () => editing_templates ? removeTemplate(name) : selectTemplate(name)
        );
        const label = document.createElement('span');
        label.textContent = name;
        chip.appendChild(label);
        if (last) {
            const detail = document.createElement('small');
            detail.textContent = `${last.duration}分・${pad2(last.start.getHours())}:${pad2(last.start.getMinutes())}`;
            const tag = document.createElement('span');
            tag.className = 'prev-tag';
            tag.textContent = '前回';
            chip.append(detail, tag);
        }
        if (editing_templates) chip.setAttribute('aria-label', `${name}を削除`);
        template_chips.appendChild(chip);
    });
    toggle_edit_btn.textContent = editing_templates ? '編集を終える' : 'テンプレートを編集';
}

function renderDates() {
    date_chips.innerHTML = '';
    const selected = draft.date ? draft.date.getTime() : null;
    ['今日', '明日', '明後日'].forEach((label, i) => {
        const date = dayOffset(i);
        const chip = chipButton(
            `chip${selected === date.getTime() ? ' is-selected' : ''}`,
            () => selectDate(date)
        );
        chip.textContent = label;
        const small = document.createElement('small');
        small.textContent = formatShortDate(date);
        chip.appendChild(small);
        date_chips.appendChild(chip);
    });
    const isOther = draft.date && !relativeDayLabel(draft.date);
    const other = chipButton(`chip${isOther ? ' is-selected' : ' ghost'}`, () => {
        date_other_input.min = toDateInputValue(dayOffset(0));
        date_other_input.value = toDateInputValue(draft.date || dayOffset(0));
        date_other_box.hidden = false;
    });
    other.textContent = 'その他';
    if (isOther) {
        const small = document.createElement('small');
        small.textContent = formatShortDate(draft.date);
        other.appendChild(small);
    }
    date_chips.appendChild(other);
}

function renderTimeNote() {
    time_note.textContent = draft.date
        ? `${relativeDayLabel(draft.date)} ${formatShortDate(draft.date)} の予定`.trim()
        : '';
}

function renderDurations() {
    duration_chips.innerHTML = '';
    const last = draft.name ? lastSettings(draft.name) : null;
    DURATION_OPTIONS.forEach(minutes => {
        const chip = chipButton(
            `chip${draft.duration === minutes ? ' is-selected' : ''}`,
            () => selectDuration(minutes)
        );
        chip.textContent = `${minutes}分`;
        if (last && last.duration === minutes) {
            const tag = document.createElement('span');
            tag.className = 'prev-tag';
            tag.textContent = '前回';
            chip.appendChild(tag);
        }
        duration_chips.appendChild(chip);
    });
    const isOther = draft.duration && !DURATION_OPTIONS.includes(draft.duration);
    const other = chipButton(`chip${isOther ? ' is-selected' : ' ghost'}`, () => {
        duration_other_input.value = isOther ? draft.duration : '';
        duration_other_box.hidden = false;
        duration_other_input.focus();
    });
    other.textContent = isOther ? `${draft.duration}分` : 'その他';
    duration_chips.appendChild(other);
}

// 「[タスク] を [日付] に [開始時刻] から [〇分間] トリカカる」の形に並べる
function renderSummary() {
    const date = draft.date;
    const parts = [
        { step: 0, value: draft.name, placeholder: 'タスク' },
        'を',
        { step: 1, value: date ? relativeDayLabel(date) || formatShortDate(date) : null, placeholder: '日付' },
        'に',
        { step: 2, value: draft.time ? `${pad2(draft.time[0])}:${pad2(draft.time[1])}` : null, placeholder: '開始時刻' },
        'から',
        { step: 3, value: draft.duration ? `${draft.duration}分間` : null, placeholder: '所要時間' },
        'トリカカる'
    ];
    summary.innerHTML = '';
    parts.forEach(part => {
        if (typeof part === 'string') {
            const joint = document.createElement('span');
            joint.className = 'summary-joint';
            joint.textContent = part;
            summary.appendChild(joint);
            return;
        }
        const pill = chipButton(`pill${part.value ? '' : ' empty'}`, () => goToStep(part.step));
        pill.textContent = part.value || `${part.placeholder}を選ぶ`;
        summary.appendChild(pill);
    });

    const start = draftStart();
    const isPast = Boolean(start) && start <= new Date();
    summary_note.textContent = isPast ? 'この時刻はもう過ぎています' : (date ? formatShortDate(date) : '');
    summary_note.classList.toggle('warn', isPast);

    notify_before_btn.classList.toggle('off', !draft.notify);
    notify_before_btn.setAttribute('aria-pressed', String(draft.notify));
    notify_before_btn.textContent = draft.notify ? '✓ 5分前に通知' : '5分前に通知';
    if (task_description.value !== draft.description) task_description.value = draft.description;

    const ready = Boolean(draft.name && date && draft.time && draft.duration);
    add_btn.disabled = saving_task || !ready || isPast;
}

function renderProgress() {
    step_progress.innerHTML = '';
    STEP_LABELS.forEach((label, i) => {
        const classes = [];
        if (i === current_step) classes.push('is-current');
        if (isStepComplete(i)) classes.push('is-done');
        const button = chipButton(classes.join(' '), () => goToStep(i));
        button.textContent = label;
        if (i === current_step) button.setAttribute('aria-current', 'step');
        step_progress.appendChild(button);
    });
    step_title.textContent = step_elements[current_step].dataset.title;
}

function renderSheet() {
    renderTemplates();
    renderDates();
    renderTimeNote();
    renderDurations();
    renderSummary();
    renderProgress();
}

// --- 操作 ---

// タスクを選ぶ。前回の設定があれば埋めるが、ステップは飛ばさず日付へ進む
function selectTemplate(name) {
    // 選び直したときは、開始時刻以外の入力をリセットする
    const time = draft.time;
    draft = emptyDraft();
    draft.time = time;
    draft.name = name;
    const last = lastSettings(name);
    if (last) {
        const hour = last.start.getHours();
        const minute = last.start.getMinutes();
        draft.duration = last.duration;
        draft.notify = last.notify;
        draft.description = last.description;
        // 前回の時刻が今日まだ来ていなければ今日、過ぎていれば明日
        const todayAtTime = dayOffset(0);
        todayAtTime.setHours(hour, minute, 0, 0);
        draft.date = dayOffset(todayAtTime > new Date() ? 0 : 1);
        time_wheel.set(hour, minute);
    }
    new_task_box.hidden = true;
    date_other_box.hidden = true;
    duration_other_box.hidden = true;
    if (draft.description) description_details.open = true;
    renderSheet();
    goToStep(1);
}

function submitNewTask() {
    const name = new_task_input.value.trim();
    if (!name) return;
    addTemplate(name);
    new_task_input.value = '';
    new_task_input.blur();
    selectTemplate(name);
}

function selectDate(date) {
    draft.date = date;
    date_other_box.hidden = true;
    renderSheet();
    goToStep(2);
}

function selectDuration(minutes) {
    draft.duration = minutes;
    duration_other_box.hidden = true;
    renderSheet();
    goToStep(4);
}

// --- ステップの移動（横スクロール + スナップ） ---

// 値が決まったときは、入力済みのステップがあっても飛ばさず、常に隣のステップへ進む
function goToStep(step) {
    const target = Math.min(LAST_STEP, Math.max(0, step));
    steps_element.scrollTo({ left: target * steps_element.clientWidth, behavior: 'smooth' });
}

let step_blur_timer;
steps_element.addEventListener('scroll', () => {
    const width = steps_element.clientWidth;
    if (!width) return;
    const step = Math.min(LAST_STEP, Math.max(0, Math.round(steps_element.scrollLeft / width)));
    if (step !== current_step) {
        // 開始時刻のステップを通り過ぎたら、ダイヤルの値で決まったものとして扱う
        if (current_step === 2 && step > 2) draft.timeConfirmed = true;
        current_step = step;
        renderProgress();
        if (step === LAST_STEP) renderSummary();
    }
    // 別のステップへ移ったら、開いているキーボードを閉じる
    clearTimeout(step_blur_timer);
    step_blur_timer = setTimeout(() => {
        const active = document.activeElement;
        if (active && active.matches('input, textarea') && active.closest('.step') !== step_elements[current_step]) {
            active.blur();
        }
    }, 150);
}, { passive: true });

// --- シートの開閉 ---

function openSheet() {
    clearTimeout(sheet_close_timer);
    draft = emptyDraft();
    editing_templates = false;
    saving_task = false;
    new_task_box.hidden = true;
    new_task_input.value = '';
    date_other_box.hidden = true;
    duration_other_box.hidden = true;
    description_details.open = false;
    sheet.style.transform = '';
    sheet_backdrop.hidden = false;
    steps_element.scrollLeft = 0;
    current_step = 0;
    // ダイヤルは表示してからでないと位置を設定できないので、表示後に「次の刻みの時刻」に合わせる
    const slot = nextTimeSlot();
    time_wheel.set(slot.getHours(), slot.getMinutes());
    renderSheet();
    requestAnimationFrame(() => requestAnimationFrame(() => sheet_backdrop.classList.add('open')));
}

function closeSheet() {
    if (sheet_backdrop.hidden) return;
    document.activeElement?.blur();
    sheet_backdrop.classList.remove('open');
    sheet.style.transform = '';
    clearTimeout(sheet_close_timer);
    sheet_close_timer = setTimeout(() => {
        sheet_backdrop.hidden = true;
    }, SHEET_TRANSITION_MS);
}

// ハンドル部分を下にドラッグして閉じる
let drag_start_y = null;
sheet_top.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button')) return;
    drag_start_y = event.clientY;
    sheet.style.transition = 'none';
    sheet_top.setPointerCapture(event.pointerId);
});
sheet_top.addEventListener('pointermove', (event) => {
    if (drag_start_y === null) return;
    sheet.style.transform = `translateY(${Math.max(0, event.clientY - drag_start_y)}px)`;
});
function endSheetDrag(event) {
    if (drag_start_y === null) return;
    const distance = event.clientY - drag_start_y;
    drag_start_y = null;
    sheet.style.transition = '';
    if (event.type === 'pointerup' && distance > SHEET_CLOSE_DRAG_PX) closeSheet();
    else sheet.style.transform = '';
}
sheet_top.addEventListener('pointerup', endSheetDrag);
sheet_top.addEventListener('pointercancel', endSheetDrag);

open_register_btn.addEventListener('click', openSheet);
close_register_btn.addEventListener('click', closeSheet);
sheet_backdrop.addEventListener('click', (event) => {
    if (event.target === sheet_backdrop) closeSheet();
});
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !sheet_backdrop.hidden) closeSheet();
});

toggle_edit_btn.addEventListener('click', () => {
    editing_templates = !editing_templates;
    new_task_box.hidden = true;
    renderTemplates();
});
document.getElementById('new_task_submit').addEventListener('click', submitNewTask);
new_task_input.addEventListener('keydown', (event) => {
    // 日本語変換の確定の Enter では決定しない
    if (event.key === 'Enter' && !event.isComposing) submitNewTask();
});

function submitOtherDate() {
    const value = date_other_input.value;
    if (!value) return;
    const [year, month, day] = value.split('-').map(Number);
    date_other_input.blur();
    selectDate(new Date(year, month - 1, day));
}
document.getElementById('date_other_submit').addEventListener('click', submitOtherDate);

function submitOtherDuration() {
    const minutes = Math.round(Number(duration_other_input.value));
    if (!Number.isFinite(minutes) || minutes <= 0) {
        showToast('所要時間を1分以上で入力してください');
        return;
    }
    duration_other_input.blur();
    selectDuration(minutes);
}
document.getElementById('duration_other_submit').addEventListener('click', submitOtherDuration);
duration_other_input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.isComposing) submitOtherDuration();
});

// ダイヤルが止まっても進まない。「次へ」で決まったものとして隣へ進む
document.getElementById('time_next').addEventListener('click', () => {
    draft.timeConfirmed = true;
    renderSheet();
    goToStep(3);
});

notify_before_btn.addEventListener('click', () => {
    draft.notify = !draft.notify;
    renderSummary();
});

task_description.addEventListener('input', () => {
    draft.description = task_description.value;
});

add_btn.addEventListener('click', async () => {
    const startDate = draftStart();
    if (!draft.name || !startDate || !draft.duration) {
        renderSummary();
        return;
    }
    if (startDate <= new Date()) {
        renderSummary();
        showToast('この時刻はもう過ぎています');
        return;
    }

    const start = Math.floor(startDate.getTime() / 1000);
    const task = {
        id: crypto.randomUUID(),
        name: draft.name,
        description: draft.description.trim(),
        start,
        end: start + draft.duration * 60,
        done: false,
        notify_before: draft.notify ? 5 : 0
    };
    saving_task = true;
    renderSummary();
    try {
        await saveTask(task);
        await showLoggedIn();
    } catch (error) {
        showToast(error.message);
        return;
    } finally {
        saving_task = false;
        renderSummary();
    }
    closeSheet();
    showToast(`「${task.name}」を追加しました`, 'success');
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
    next_task.href = `../timer/index.html?${new URLSearchParams({ task: nextTask.id })}`;
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

// type は 'error'（赤）か 'success'（緑）。正常な知らせをエラーと見間違えないよう色とアイコンを分ける
function showToast(message, type = 'error') {
    clearTimeout(toast_timer);
    const success = type === 'success';
    toast.classList.toggle('is-success', success);
    toast_icon.className = `fa-solid ${success ? 'fa-circle-check' : 'fa-circle-exclamation'}`;
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

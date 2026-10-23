
const register_container = document.getElementById('register_container');
const add_btn = document.getElementById('add-btn');
const open_register_btn = document.getElementById('open_register');

// 登録モーダルを非表示にする
add_btn.addEventListener('click', () => {
    register_container.style.display = 'none';
});

// 登録モーダルを表示する
open_register_btn.addEventListener('click', () => {
    register_container.style.display = 'flex';
});


const task_time = document.getElementById('task_time');
const task_name = document.getElementById('task_name');
const task_list = document.getElementById('task_list');

let tasks = [];


// 「登録」ボタンが押されたときの処理
add_btn.addEventListener('click', () => {
    const time = task_time.value;
    const name = task_name.value;

    // 未入力があれば処理を中断
    if (!time || !name) return;

    // 配列にタスクを追加し、時間順にソート
    tasks.push({ time, name });
    tasks.sort((a, b) => a.time.localeCompare(b.time));

    // 一覧の再描画と入力欄のクリア
    renderTasks();
    task_time.value = '';
    task_name.value = '';
});

// タスク一覧を画面に描画する関数
function renderTasks() {
    task_list.innerHTML = '';
    tasks.forEach(task => {
        const li = document.createElement('li');
        li.textContent = `${task.time} - ${task.name}`;
        task_list.appendChild(li);
    });
}

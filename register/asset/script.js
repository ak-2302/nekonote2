
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
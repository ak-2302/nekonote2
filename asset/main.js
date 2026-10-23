const TOTAL_MS = 60 * 1000; // タイマーの長さ（ミリ秒）
let remainingMs = TOTAL_MS; // 一時停止中の残り時間
let endAt = null;           // 動いているときの終了時刻。null なら止まっている
let rafId = null;

const timerElement = document.getElementById('timer');
const endTimeElement = document.getElementById('endTime');
const ring = document.getElementById('ring');
const ringBar = document.getElementById('ringBar');
const pauseBtn = document.getElementById('pauseBtn');
const endBtn = document.getElementById('endBtn');

// 円の周の長さ（r=90）。この長さ分だけ線をずらすと円が消える
const CIRC = 2 * Math.PI * 90;
ringBar.style.strokeDasharray = CIRC;

// 今の残り時間（動いているときは終了時刻から計算）
function currentRemaining() {
    return endAt === null ? remainingMs : Math.max(0, endAt - Date.now());
}

// 表示の更新
function updateDisplay() {
    const ms = currentRemaining();
    const totalSec = Math.ceil(ms / 1000);
    const minutes = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const seconds = String(totalSec % 60).padStart(2, '0');
    timerElement.textContent = `${minutes}:${seconds}`;

    // 円グラフ：残り時間の割合だけ線を残す（毎フレーム計算するのでなめらか）
    ringBar.style.strokeDashoffset = CIRC * (1 - ms / TOTAL_MS);

    const paused = endAt === null;
    ring.classList.toggle('is-paused', paused);

    if (ms <= 0) {
        endTimeElement.textContent = '時間です';
        pauseBtn.disabled = true;
    } else if (paused) {
        endTimeElement.textContent = '一時停止中';
        pauseBtn.textContent = '再開';
        pauseBtn.disabled = false;
    } else {
        const end = new Date(endAt);
        endTimeElement.textContent = `${end.getHours()}:${String(end.getMinutes()).padStart(2, '0')}まで`;
        pauseBtn.textContent = '一時停止';
        pauseBtn.disabled = false;
    }
}

// 画面の描き換えごとに呼ばれる
function tick() {
    if (currentRemaining() <= 0) {
        finishTimer();
        return;
    }
    updateDisplay();
    rafId = requestAnimationFrame(tick);
}

// タイマーの開始・再開
function startTimer() {
    if (endAt !== null || remainingMs <= 0) return; // 既に動いているか、0秒のときは何もしない
    endAt = Date.now() + remainingMs;
    tick();
}

// 一時停止（押した瞬間の残り時間で止める）
function pauseTimer() {
    if (endAt === null) return;
    remainingMs = currentRemaining();
    endAt = null;
    cancelAnimationFrame(rafId);
    updateDisplay();
}

// 時間切れ
function finishTimer() {
    cancelAnimationFrame(rafId);
    endAt = null;
    remainingMs = 0;
    updateDisplay();
    setTimeout(() => alert('時間です！'), 50); // 00:00 を表示してから知らせる
}

// 終了（タイマーを止めて最初に戻す）
function stopTimer() {
    cancelAnimationFrame(rafId);
    endAt = null;
    remainingMs = TOTAL_MS;
    updateDisplay();
}

// ボタン
pauseBtn.addEventListener('click', () => {
    if (endAt === null) {
        startTimer();
    } else {
        pauseTimer();
    }
});
endBtn.addEventListener('click', stopTimer);

// 読み込み完了と同時にスタート
updateDisplay();
startTimer();
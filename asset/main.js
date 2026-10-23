const TOTAL = 60;
let timeLeft = TOTAL;
let timerId = null;


const timerElement = document.getElementById('timer');
const endTimeElement = document.getElementById('endTime');
const ring = document.getElementById('ring');
const ringBar = document.getElementById('ringBar');
const pauseBtn = document.getElementById('pauseBtn');
const endBtn = document.getElementById('endBtn');
 
// 円の周の長さ（r=90）。この長さ分だけ線をずらすと円が消える
const CIRC = 2 * Math.PI * 90;
ringBar.style.strokeDasharray = CIRC;
 
// 表示の更新
function updateDisplay() {
    const minutes = String(Math.floor(timeLeft / 60)).padStart(2, '0');
    const seconds = String(timeLeft % 60).padStart(2, '0');
    timerElement.textContent = `${minutes}:${seconds}`;
 
    // 円グラフ：残り時間の割合だけ線を残す
    ringBar.style.strokeDashoffset = CIRC * (1 - timeLeft / TOTAL);
 
    const paused = timerId === null;
    ring.classList.toggle('is-paused', paused);
 
    if (timeLeft <= 0) {
        endTimeElement.textContent = '時間です';
        pauseBtn.disabled = true;
    } else if (paused) {
        endTimeElement.textContent = '一時停止中';
        pauseBtn.textContent = '再開';
        pauseBtn.disabled = false;
    } else {
        const end = new Date(Date.now() + timeLeft * 1000);
        endTimeElement.textContent = `${end.getHours()}:${String(end.getMinutes()).padStart(2, '0')}まで`;
        pauseBtn.textContent = '一時停止';
        pauseBtn.disabled = false;
    }
}
 
// タイマーの開始・再開
function startTimer() {
    if (timerId !== null || timeLeft <= 0) return; // 既に動いているか、0秒のときは何もしない
    timerId = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
            pauseTimer();
            setTimeout(() => alert('時間です！'), 50); // 00:00 を表示してから知らせる
        } else {
            updateDisplay();
        }
    }, 1000);
    updateDisplay();
}
 
// 一時停止
function pauseTimer() {
    clearInterval(timerId);
    timerId = null;
    updateDisplay();
}
 
// 終了（タイマーを止めて最初に戻す）
function stopTimer() {
    clearInterval(timerId);
    timerId = null;
    timeLeft = TOTAL;
    updateDisplay();
}
 
// ボタン
pauseBtn.addEventListener('click', () => {
    if (timerId === null) {
        startTimer();
    } else {
        pauseTimer();
    }
});
endBtn.addEventListener('click', stopTimer);
 
// 読み込み完了と同時にスタート
updateDisplay();
startTimer();
// 時刻をスクロールで選ぶダイヤル。
// iOS・Android・PCで同じ見た目にし、タップせずにすぐ操作できるよう自作している。
// 選んだ値は hidden の input に "HH:MM" で書き込むので、フォーム側は普通の時刻入力と同じように読める。

const WHEEL_ITEM_HEIGHT = 32;    // style.css の .wheel-item の高さと合わせる
const WHEEL_VISIBLE_ITEMS = 5;   // 見える行数（奇数）。真ん中の行が選択中
const WHEEL_LOOP_COPIES = 5;     // ループ時に値の並びを何周分並べるか（奇数）

// loop: true にすると末尾の次が先頭に戻る（59 の次が 00）。
// 値の並びを何周分か並べておき、スクロールが止まるたびに見た目を変えずに真ん中の周へ戻すことで、端に着かないようにしている。
function createWheelColumn(element, values, format, onChange, { loop = false } = {}) {
    const count = values.length;
    const copies = loop ? WHEEL_LOOP_COPIES : 1;
    const middleCopy = Math.floor(copies / 2);
    const spacerHeight = WHEEL_ITEM_HEIGHT * Math.floor(WHEEL_VISIBLE_ITEMS / 2);
    let position = 0;    // 並べた行の中での位置（ループ時は count × copies 行）
    let settleTimer;

    element.innerHTML = '';
    element.tabIndex = 0;
    element.setAttribute('role', 'spinbutton');
    element.setAttribute('aria-valuemin', values[0]);
    element.setAttribute('aria-valuemax', values[count - 1]);

    // 先頭と末尾の行も真ん中まで来られるよう、上下に余白を入れる
    const spacer = () => {
        const div = document.createElement('div');
        div.style.height = `${spacerHeight}px`;
        return div;
    };
    element.appendChild(spacer());
    const items = [];
    for (let i = 0; i < count * copies; i++) {
        const item = document.createElement('div');
        item.className = 'wheel-item';
        item.textContent = format(values[i % count]);
        item.addEventListener('click', () => scrollToPosition(i, true));
        element.appendChild(item);
        items.push(item);
    }
    element.appendChild(spacer());

    const clamp = (p) => Math.min(items.length - 1, Math.max(0, p));
    const positionAtScroll = () => clamp(Math.round(element.scrollTop / WHEEL_ITEM_HEIGHT));
    const valueIndex = (p) => p % count;

    function highlight(p) {
        items.forEach((item, j) => item.classList.toggle('is-selected', j === p));
    }

    function commit(p) {
        position = clamp(p);
        highlight(position);
        const value = values[valueIndex(position)];
        element.setAttribute('aria-valuenow', value);
        element.setAttribute('aria-valuetext', format(value));
        onChange();
    }

    function scrollToPosition(p, smooth) {
        const target = clamp(p);
        element.scrollTo({ top: target * WHEEL_ITEM_HEIGHT, behavior: smooth ? 'smooth' : 'auto' });
        commit(target);
    }

    // 同じ値のまま真ん中の周へ瞬間移動する（見た目は変わらない）
    function recenter() {
        if (!loop) return;
        const centered = middleCopy * count + valueIndex(position);
        if (centered === position) return;
        element.scrollTop = centered * WHEEL_ITEM_HEIGHT;
        position = centered;
        highlight(position);
    }

    // スクロール中は見た目だけ追従させ、止まってから値を確定する
    element.addEventListener('scroll', () => {
        highlight(positionAtScroll());
        clearTimeout(settleTimer);
        settleTimer = setTimeout(() => {
            commit(positionAtScroll());
            recenter();
        }, 120);
    }, { passive: true });

    element.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowUp') scrollToPosition(position - 1, true);
        else if (event.key === 'ArrowDown') scrollToPosition(position + 1, true);
        else return;
        event.preventDefault();
    });

    return {
        get value() {
            return values[valueIndex(position)];
        },
        set(value) {
            const i = Math.max(0, values.indexOf(value));
            scrollToPosition(middleCopy * count + i, false);
        }
    };
}

function createTimeWheel({ hourElement, minuteElement, input, minuteStep }) {
    const pad = (value) => String(value).padStart(2, '0');
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep);
    let hour;
    let minute;
    const sync = () => {
        if (hour && minute) input.value = `${pad(hour.value)}:${pad(minute.value)}`;
    };
    hour = createWheelColumn(hourElement, hours, pad, sync, { loop: true });
    minute = createWheelColumn(minuteElement, minutes, pad, sync, { loop: true });

    return {
        // 表示中（hidden でない）ときに呼ぶこと。非表示だとスクロール位置を設定できない
        set(h, m) {
            hour.set(h);
            minute.set(m);
            sync();
        }
    };
}

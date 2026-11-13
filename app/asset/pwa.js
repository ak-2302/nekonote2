const serviceWorkerReady = 'serviceWorker' in navigator
    ? navigator.serviceWorker.register('../service-worker.js', { scope: '../' })
        .then(() => navigator.serviceWorker.ready)
        .catch((error) => {
            console.warn('Service Workerを登録できませんでした', error);
            return null;
        })
    : Promise.resolve(null);

// iPhoneはホーム画面に追加したアプリでしかプッシュ通知を使えない
function isPushSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function base64UrlToUint8Array(base64Url) {
    const base64 = (base64Url + '='.repeat((4 - base64Url.length % 4) % 4))
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

// 通知の許可を求め、この端末をログイン中のユーザーの通知先として登録する。
// 許可ダイアログはボタン操作の中でしか出せないので、クリック時に呼ぶこと。
async function enablePushNotifications() {
    if (!isPushSupported()) {
        throw new Error('この環境では通知を使えません。iPhoneはホーム画面に追加してから開いてください');
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('通知が許可されませんでした');
    await syncPushSubscription();
}

// 許可済みなら購読を作り直さずにサーバーへ登録し直す（ログイン後やサーバー再起動後用）
async function syncPushSubscription() {
    if (!isPushSupported() || Notification.permission !== 'granted') return false;
    const registration = await serviceWorkerReady;
    if (!registration) return false;
    const publicKey = await getPushPublicKey();
    let subscription = await registration.pushManager.getSubscription();
    // サーバーの鍵が変わっていたら古い購読は使えないので作り直す
    const currentKey = subscription?.options?.applicationServerKey;
    if (subscription && currentKey) {
        const current = new Uint8Array(currentKey);
        const expected = base64UrlToUint8Array(publicKey);
        if (current.length !== expected.length || current.some((byte, i) => byte !== expected[i])) {
            await subscription.unsubscribe();
            subscription = null;
        }
    }
    if (!subscription) {
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: base64UrlToUint8Array(publicKey)
        });
    }
    await sendPushSubscription(subscription);
    return true;
}

// ログアウト時に、この端末へ前のユーザーの通知が届かないようにする
async function disablePushForCurrentUser() {
    if (!isPushSupported()) return;
    const registration = await serviceWorkerReady;
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) await removePushSubscription(subscription.endpoint);
}

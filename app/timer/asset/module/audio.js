const AUDIO_API_URL = 'https://nekonoteapi.meiteya.workers.dev/api/audio';

// [AI] APIの一覧に含まれるパスへ変更すると、タイマー中に再生する音源を切り替えられる。
export const SELECTED_AUDIO_PATH = 'PokemonRG_Music/02 マサラタウンのテーマ.opus';

let timer_audio;
let audio_list_promise;
let should_play = false;

async function getAudioList() {
    if (!audio_list_promise) {
        audio_list_promise = fetch(AUDIO_API_URL, { cache: 'no-store' })
            .then((response) => {
                if (!response.ok) throw new Error(`音源一覧API: ${response.status}`);
                return response.json();
            })
            .then((payload) => {
                if (!Array.isArray(payload.files)) throw new Error('音源一覧の形式が不正です');
                return payload.files;
            })
            .catch((error) => {
                audio_list_promise = undefined;
                throw error;
            });
    }
    return audio_list_promise;
}

export async function playTimerAudio() {
    should_play = true;

    try {
        const audio_list = await getAudioList();
        const selected_audio = audio_list.find((audio) => audio.path === SELECTED_AUDIO_PATH);
        if (!selected_audio?.url || !should_play) return;

        if (!timer_audio || timer_audio.src !== selected_audio.url) {
            if (timer_audio) timer_audio.pause();
            timer_audio = new Audio(selected_audio.url);
            timer_audio.loop = true;
            timer_audio.preload = 'metadata';
        }
        await timer_audio.play();
    } catch (error) {
        console.warn('タイマー音楽を再生できませんでした', error);
    }
}

export function pauseTimerAudio() {
    should_play = false;
    timer_audio?.pause();
}

export function stopTimerAudio() {
    should_play = false;
    if (!timer_audio) return;
    timer_audio.pause();
    timer_audio.currentTime = 0;
}

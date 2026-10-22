// Firebase Realtime Database 설정 (프로젝트 ID: sukyoung-7b1e6)
// 만약 파이어베이스 콘솔의 실시간 데이터베이스 주소가 아시아 서버 등 다른 리전이라면
// 아래 defaultDbUrl 값을 콘솔에 표시된 주소(예: https://sukyoung-7b1e6-default-rtdb.asia-southeast1.firebasedatabase.app)로 변경하거나
// 관리자 페이지에서 주소를 입력할 수 있습니다.
const DEFAULT_DB_URL = localStorage.getItem('customFirebaseDbUrl') || "https://sukyoung-7b1e6-default-rtdb.firebaseio.com";

const firebaseConfig = {
    projectId: "sukyoung-7b1e6",
    databaseURL: DEFAULT_DB_URL
};

// Firebase 초기화
let db = null;
try {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    db = firebase.database();
} catch (e) {
    console.warn("Firebase 초기화 확인 필요:", e);
}

/**
 * [서버 용량 및 연결 최소화 유틸리티]
 * 1. 이미지 초경량 압축 함수 (Canvas 활용)
 *    - 가로/세로 최대 360px로 축소
 *    - WebP 포맷(지원 안 될 경우 JPEG) 및 품질 0.5 적용
 *    - 수 MB의 원본 사진을 약 10KB ~ 25KB 수준으로 압축하여 1GB 한도를 극도로 아낍니다.
 */
function compressImageFile(file, maxWidth = 360, quality = 0.5) {
    return new Promise((resolve, reject) => {
        if (!file) {
            resolve(null);
            return;
        }
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // 비율 유지하며 해상도 축소
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxWidth) {
                        width = Math.round((width * maxWidth) / height);
                        height = maxWidth;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');

                // 흰색 배경 채우기 (투명 PNG 변환 시 검은 배경 방지)
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                // 가장 용량이 작은 WebP 우선 시도, 미지원 브라우저는 JPEG로 폴백
                let dataUrl = canvas.toDataURL('image/webp', quality);
                if (!dataUrl.startsWith('data:image/webp')) {
                    dataUrl = canvas.toDataURL('image/jpeg', quality);
                }

                // 대략적인 바이트 크기 계산
                const compressedBytes = Math.round((dataUrl.length * 3) / 4);
                resolve({
                    dataUrl,
                    originalSizeKB: (file.size / 1024).toFixed(1),
                    compressedSizeKB: (compressedBytes / 1024).toFixed(1),
                    width,
                    height
                });
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

/**
 * [동시 접속자(Connections) 절약형 데이터 읽기/쓰기]
 * 실시간 소켓(on)을 계속 열어두면 방문자마다 연결 수를 차지하므로,
 * 필요할 때만 연결(goOnline)하여 1회성(once)으로 데이터를 가져온 뒤
 * 즉시 오프라인(goOffline)으로 전환해 서버 연결 점유율을 0에 가깝게 유지합니다.
 */
async function fetchFromDB(path, limit = 30) {
    if (!db) return null;
    try {
        firebase.database().goOnline();
        const ref = limit ? db.ref(path).limitToLast(limit) : db.ref(path);
        const snapshot = await ref.once('value');
        const val = snapshot.val();
        // 데이터 수신 직후 연결을 닫아 동시 연결(Connections) 수 절약
        setTimeout(() => firebase.database().goOffline(), 1500);
        return val;
    } catch (err) {
        console.warn(`DB 읽기 실패 (${path}):`, err);
        return null;
    }
}

async function writeToDB(path, data) {
    if (!db) throw new Error("Firebase DB가 초기화되지 않았습니다.");
    firebase.database().goOnline();
    await db.ref(path).set(data);
    setTimeout(() => firebase.database().goOffline(), 1500);
}

async function pushToDB(path, data) {
    if (!db) throw new Error("Firebase DB가 초기화되지 않았습니다.");
    firebase.database().goOnline();
    const newRef = db.ref(path).push();
    await newRef.set({ ...data, id: newRef.key });
    setTimeout(() => firebase.database().goOffline(), 1500);
    return newRef.key;
}

async function updateInDB(path, updates) {
    if (!db) throw new Error("Firebase DB가 초기화되지 않았습니다.");
    firebase.database().goOnline();
    await db.ref(path).update(updates);
    setTimeout(() => firebase.database().goOffline(), 1500);
}

async function removeFromDB(path) {
    if (!db) throw new Error("Firebase DB가 초기화되지 않았습니다.");
    firebase.database().goOnline();
    await db.ref(path).remove();
    setTimeout(() => firebase.database().goOffline(), 1500);
}

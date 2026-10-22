// 기본 샘플 육아용품 데이터 (DB가 비어있을 때 초기 표시용)
const defaultItems = [
    { id: 'item_1', title: '바운서', category: '육아용품', status: 'available', image: 'https://images.unsplash.com/photo-1544422216-5bc77b9319e5?auto=format&fit=crop&q=80&w=400&h=300' },
    { id: 'item_2', title: '쏘서', category: '육아용품', status: 'rented', image: 'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&q=80&w=400&h=300' },
    { id: 'item_3', title: '유모차 (디럭스)', category: '육아용품', status: 'available', image: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&q=80&w=400&h=300' },
    { id: 'item_4', title: '원목 블록 세트', category: '장난감', status: 'available', image: 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&q=80&w=400&h=300' },
    { id: 'item_5', title: '사운드북 세트', category: '도서/장난감', status: 'rented', image: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=400&h=300' },
    { id: 'item_6', title: '보행기', category: '육아용품', status: 'available', image: 'https://images.unsplash.com/photo-1586524674751-6c39cb8a9f62?auto=format&fit=crop&q=80&w=400&h=300' }
];

// 후기 첨부용 압축 이미지 임시 보관 변수
let currentCompressedReviewPhoto = null;

// 로컬 스토리지 초기화 (오프라인 또는 초기 백업용)
if (!localStorage.getItem('welcomeBabyItems')) {
    localStorage.setItem('welcomeBabyItems', JSON.stringify(defaultItems));
}
if (!localStorage.getItem('welcomeBabyReviews')) {
    localStorage.setItem('welcomeBabyReviews', JSON.stringify([]));
}
if (!localStorage.getItem('welcomeBabyQnA')) {
    localStorage.setItem('welcomeBabyQnA', JSON.stringify([]));
}

// 객체를 배열로 변환 (최신순 정렬)
function objectToArray(obj) {
    if (!obj) return [];
    if (Array.isArray(obj)) return obj.filter(Boolean);
    return Object.keys(obj).map(key => ({
        ...obj[key],
        id: obj[key].id || key
    })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

// 페이지 로드 시 데이터 불러오기 (1회성 조회로 서버 연결 최소화)
document.addEventListener('DOMContentLoaded', async () => {
    if (document.getElementById('item-grid')) {
        await loadAllData();
    }
});

async function loadAllData() {
    // 먼저 로컬 캐시로 빠르게 화면 렌더링
    renderItems(JSON.parse(localStorage.getItem('welcomeBabyItems')) || defaultItems);
    renderReviews(JSON.parse(localStorage.getItem('welcomeBabyReviews')) || []);
    renderQnA(JSON.parse(localStorage.getItem('welcomeBabyQnA')) || []);

    // 파이어베이스 실시간 데이터베이스에서 최신 데이터 1회성 조회 (최근 30개만 가져와 용량 절약)
    try {
        const [remoteItems, remoteReviews, remoteQnA] = await Promise.all([
            fetchFromDB('items', 50),
            fetchFromDB('reviews', 25),
            fetchFromDB('qna', 30)
        ]);

        if (remoteItems) {
            const itemsArr = objectToArray(remoteItems);
            if (itemsArr.length > 0) {
                localStorage.setItem('welcomeBabyItems', JSON.stringify(itemsArr));
                renderItems(itemsArr);
            }
        } else {
            // DB에 초기 물품이 아예 없을 경우 기본 물품 1회 업로드 시도
            const initialObj = {};
            defaultItems.forEach((item, idx) => {
                initialObj[item.id] = { ...item, createdAt: Date.now() - idx * 1000 };
            });
            writeToDB('items', initialObj).catch(() => {});
        }

        if (remoteReviews) {
            const reviewsArr = objectToArray(remoteReviews);
            localStorage.setItem('welcomeBabyReviews', JSON.stringify(reviewsArr));
            renderReviews(reviewsArr);
        }

        if (remoteQnA) {
            const qnaArr = objectToArray(remoteQnA);
            localStorage.setItem('welcomeBabyQnA', JSON.stringify(qnaArr));
            renderQnA(qnaArr);
        }
    } catch (e) {
        console.warn('서버 데이터 동기화 중 오류 (로컬 캐시 사용):', e);
    }
}

// 1. 육아용품 목록 렌더링
function renderItems(items) {
    const grid = document.getElementById('item-grid');
    if (!grid) return;
    grid.innerHTML = '';

    items.forEach(item => {
        const isAvailable = item.status === 'available';
        const statusText = isAvailable ? '대여 가능' : '대여 중';
        const statusClass = isAvailable ? 'status-available' : 'status-rented';

        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `
            <div class="item-image-wrapper">
                <img src="${item.image}" alt="${escapeHtml(item.title)}" loading="lazy">
                <div class="item-hover-overlay">${escapeHtml(item.category)}</div>
            </div>
            <div class="item-info">
                <div class="item-title">${escapeHtml(item.title)}</div>
                <div class="status-badge ${statusClass}">${statusText}</div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// 2. 후기 사진 선택 시 초경량 압축 미리보기
async function previewReviewPhoto(event) {
    const file = event.target.files[0];
    const infoBadge = document.getElementById('review-photo-info');
    const previewWrap = document.getElementById('review-photo-preview-wrap');
    const previewImg = document.getElementById('review-photo-preview');

    if (!file) {
        clearReviewPhoto();
        return;
    }

    try {
        infoBadge.style.display = 'inline-block';
        infoBadge.textContent = '사진 용량 줄이는 중...';

        // 가로/세로 최대 320px, 품질 0.5로 초경량 압축 (약 10~20KB)
        const result = await compressImageFile(file, 320, 0.5);
        currentCompressedReviewPhoto = result.dataUrl;

        previewImg.src = result.dataUrl;
        previewWrap.style.display = 'flex';
        infoBadge.textContent = `원본 ${result.originalSizeKB}KB ➔ 압축 ${result.compressedSizeKB}KB (서버 용량 초절약 완료!)`;
    } catch (err) {
        alert('이미지를 처리하는 중 오류가 발생했습니다.');
        clearReviewPhoto();
    }
}

function clearReviewPhoto() {
    currentCompressedReviewPhoto = null;
    const fileInput = document.getElementById('review-photo');
    const infoBadge = document.getElementById('review-photo-info');
    const previewWrap = document.getElementById('review-photo-preview-wrap');
    if (fileInput) fileInput.value = '';
    if (infoBadge) {
        infoBadge.style.display = 'none';
        infoBadge.textContent = '';
    }
    if (previewWrap) previewWrap.style.display = 'none';
}

// 3. 후기 등록 (파이어베이스 + 로컬 백업)
async function addReview() {
    const nameInput = document.getElementById('reviewer-name');
    const contentInput = document.getElementById('review-content');
    const submitBtn = document.getElementById('review-submit-btn');

    const name = nameInput.value.trim();
    const content = contentInput.value.trim();

    if (!name || !content) {
        alert('이름과 후기 내용을 모두 입력해주세요.');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = '등록 중...';

    const newReview = {
        id: 'rev_' + Date.now(),
        name: name,
        content: content,
        photo: currentCompressedReviewPhoto || null,
        date: new Date().toLocaleDateString('ko-KR'),
        createdAt: Date.now()
    };

    try {
        await writeToDB(`reviews/${newReview.id}`, newReview);
    } catch (err) {
        console.warn('파이어베이스 저장 실패 (로컬에 저장됨):', err);
    }

    const reviews = JSON.parse(localStorage.getItem('welcomeBabyReviews')) || [];
    reviews.unshift(newReview);
    localStorage.setItem('welcomeBabyReviews', JSON.stringify(reviews));

    nameInput.value = '';
    contentInput.value = '';
    clearReviewPhoto();
    submitBtn.disabled = false;
    submitBtn.textContent = '후기 등록';

    renderReviews(reviews);
}

function renderReviews(reviews) {
    const list = document.getElementById('review-list');
    if (!list) return;

    list.innerHTML = '';

    if (!reviews || reviews.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:#999;">아직 등록된 후기가 없습니다. 첫 후기를 남겨주세요!</p>';
        return;
    }

    reviews.forEach(review => {
        const item = document.createElement('div');
        item.className = 'review-item';
        const photoHtml = review.photo
            ? `<div class="review-photo-display"><img src="${review.photo}" alt="후기 사진" loading="lazy"></div>`
            : '';

        item.innerHTML = `
            <div class="review-header">
                <span class="reviewer-name">${escapeHtml(review.name)}</span>
                <span class="review-date">${escapeHtml(review.date || '')}</span>
            </div>
            <div class="review-body">
                ${escapeHtml(review.content)}
                ${photoHtml}
            </div>
        `;
        list.appendChild(item);
    });
}

// 4. Q&A 질문 등록 및 목록 표시
async function addQuestion() {
    const nameInput = document.getElementById('qna-name');
    const questionInput = document.getElementById('qna-question');
    const submitBtn = document.getElementById('qna-submit-btn');

    const name = nameInput.value.trim();
    const question = questionInput.value.trim();

    if (!name || !question) {
        alert('작성자 이름과 질문 내용을 모두 입력해주세요.');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = '질문 등록 중...';

    const newQnA = {
        id: 'qna_' + Date.now(),
        name: name,
        question: question,
        answer: '',
        date: new Date().toLocaleDateString('ko-KR'),
        createdAt: Date.now()
    };

    try {
        await writeToDB(`qna/${newQnA.id}`, newQnA);
    } catch (err) {
        console.warn('파이어베이스 Q&A 저장 실패 (로컬에 저장됨):', err);
    }

    const qnaList = JSON.parse(localStorage.getItem('welcomeBabyQnA')) || [];
    qnaList.unshift(newQnA);
    localStorage.setItem('welcomeBabyQnA', JSON.stringify(qnaList));

    nameInput.value = '';
    questionInput.value = '';
    submitBtn.disabled = false;
    submitBtn.textContent = '질문 등록하기';

    renderQnA(qnaList);
}

function renderQnA(qnaList) {
    const list = document.getElementById('qna-list');
    if (!list) return;

    list.innerHTML = '';

    if (!qnaList || qnaList.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:#999;">아직 등록된 질문이 없습니다. 궁금한 점을 편하게 남겨주세요!</p>';
        return;
    }

    qnaList.forEach(item => {
        const hasAnswer = item.answer && item.answer.trim() !== '';
        const badgeClass = hasAnswer ? 'qna-answered' : 'qna-waiting';
        const badgeText = hasAnswer ? '답변 완료' : '답변 대기중';

        const answerHtml = hasAnswer
            ? `<div class="qna-answer-box">
                   <div class="qna-answer-title">💌 복지관 관리자 답변</div>
                   <div class="qna-answer-text">${escapeHtml(item.answer)}</div>
               </div>`
            : '';

        const div = document.createElement('div');
        div.className = 'qna-item';
        div.innerHTML = `
            <div class="qna-header">
                <div>
                    <span class="qna-badge ${badgeClass}">${badgeText}</span>
                    <span class="qna-author">${escapeHtml(item.name)}</span>
                </div>
                <span class="qna-date">${escapeHtml(item.date || '')}</span>
            </div>
            <div class="qna-question-text">Q. ${escapeHtml(item.question)}</div>
            ${answerHtml}
        `;
        list.appendChild(div);
    });
}

// XSS 방지용 텍스트 이스케이프
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Default items data
const defaultItems = [
    { id: 1, title: '바운서', category: '육아용품', status: 'available', image: 'https://images.unsplash.com/photo-1544422216-5bc77b9319e5?auto=format&fit=crop&q=80&w=400&h=300' },
    { id: 2, title: '쏘서', category: '육아용품', status: 'rented', image: 'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&q=80&w=400&h=300' },
    { id: 3, title: '유모차 (디럭스)', category: '육아용품', status: 'available', image: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&q=80&w=400&h=300' },
    { id: 4, title: '원목 블록 세트', category: '장난감', status: 'available', image: 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&q=80&w=400&h=300' },
    { id: 5, title: '사운드북 세트', category: '도서/장난감', status: 'rented', image: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=400&h=300' },
    { id: 6, title: '보행기', category: '육아용품', status: 'available', image: 'https://images.unsplash.com/photo-1586524674751-6c39cb8a9f62?auto=format&fit=crop&q=80&w=400&h=300' }
];

// Initialize local storage if empty
if (!localStorage.getItem('welcomeBabyItems')) {
    localStorage.setItem('welcomeBabyItems', JSON.stringify(defaultItems));
}
if (!localStorage.getItem('welcomeBabyReviews')) {
    localStorage.setItem('welcomeBabyReviews', JSON.stringify([]));
}

// Load items on page load (for index.html)
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('item-grid')) {
        renderItems();
        renderReviews();
    }
});

function renderItems() {
    const grid = document.getElementById('item-grid');
    grid.innerHTML = '';
    const items = JSON.parse(localStorage.getItem('welcomeBabyItems'));

    items.forEach(item => {
        const isAvailable = item.status === 'available';
        const statusText = isAvailable ? '대여 가능' : '대여 중';
        const statusClass = isAvailable ? 'status-available' : 'status-rented';

        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `
            <div class="item-image-wrapper">
                <img src="${item.image}" alt="${item.title}">
                <div class="item-hover-overlay">${item.category}</div>
            </div>
            <div class="item-info">
                <div class="item-title">${item.title}</div>
                <div class="status-badge ${statusClass}">${statusText}</div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function addReview() {
    const nameInput = document.getElementById('reviewer-name');
    const contentInput = document.getElementById('review-content');
    
    const name = nameInput.value.trim();
    const content = contentInput.value.trim();

    if (!name || !content) {
        alert('이름과 후기 내용을 모두 입력해주세요.');
        return;
    }

    const reviews = JSON.parse(localStorage.getItem('welcomeBabyReviews'));
    const newReview = {
        id: Date.now(),
        name: name,
        content: content,
        date: new Date().toLocaleDateString('ko-KR')
    };

    reviews.unshift(newReview);
    localStorage.setItem('welcomeBabyReviews', JSON.stringify(reviews));

    nameInput.value = '';
    contentInput.value = '';
    
    renderReviews();
}

function renderReviews() {
    const list = document.getElementById('review-list');
    if (!list) return;

    list.innerHTML = '';
    const reviews = JSON.parse(localStorage.getItem('welcomeBabyReviews'));

    if (reviews.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:#999;">아직 등록된 후기가 없습니다. 첫 후기를 남겨주세요!</p>';
        return;
    }

    reviews.forEach(review => {
        const item = document.createElement('div');
        item.className = 'review-item';
        item.innerHTML = `
            <div class="review-header">
                <span class="reviewer-name">${review.name}</span>
                <span class="review-date">${review.date}</span>
            </div>
            <div class="review-body">
                ${review.content}
            </div>
        `;
        list.appendChild(item);
    });
}

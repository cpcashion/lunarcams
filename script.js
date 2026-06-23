const cameras = [
    { id: 'LC-01', title: 'Tycho Crater', loc: 'Southern Highlands', lat: '43.31° S', lng: '11.36° W', alt: '112 km', img: 'https://images.unsplash.com/photo-1522030239044-1293df656541?auto=format&fit=crop&q=80&w=1200' },
    { id: 'LC-02', title: 'Sea of Tranquility', loc: 'Mare Tranquillitatis', lat: '0.67° N', lng: '23.47° E', alt: '98 km', img: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?auto=format&fit=crop&q=80&w=1200' },
    { id: 'LC-03', title: 'Copernicus Crater', loc: 'Mare Insularum', lat: '9.62° N', lng: '20.08° W', alt: '105 km', img: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&q=80&w=1200' },
    { id: 'LC-04', title: 'Mare Imbrium', loc: 'Sea of Rains', lat: '32.8° N', lng: '15.6° W', alt: '120 km', img: 'https://images.unsplash.com/photo-1506703380610-bf81f7742cf1?auto=format&fit=crop&q=80&w=1200' },
    { id: 'LC-05', title: 'Oceanus Procellarum', loc: 'Ocean of Storms', lat: '18.4° N', lng: '57.4° W', alt: '110 km', img: 'https://images.unsplash.com/photo-1532601224476-15c79f2f7a51?auto=format&fit=crop&q=80&w=1200' },
    { id: 'LC-06', title: 'Mare Serenitatis', loc: 'Sea of Serenity', lat: '28.0° N', lng: '17.5° E', alt: '95 km', img: 'https://images.unsplash.com/photo-1446941611757-91d2c3bd3d45?auto=format&fit=crop&q=80&w=1200' }
];

function init() {
    const grid = document.getElementById('camera-grid');
    cameras.forEach(cam => {
        const card = document.createElement('div');
        card.className = `cam-card ${cam.id === 'LC-01' ? 'active' : ''}`;
        card.innerHTML = `
            <div class="cam-thumb"><img src="${cam.img}" alt="${cam.title}"></div>
            <div class="cam-title">${cam.id} · ${cam.title}</div>
            <div class="cam-loc">${cam.loc}</div>
        `;
        card.onclick = () => setActiveCamera(cam, card);
        grid.appendChild(card);
    });

    setInterval(updateClock, 1000);
    updateClock();
}

function setActiveCamera(cam, cardEl) {
    document.querySelectorAll('.cam-card').forEach(el => el.classList.remove('active'));
    cardEl.classList.add('active');

    document.getElementById('active-cam-title').innerText = cam.title;
    document.getElementById('main-feed-img').src = cam.img;
    document.getElementById('tel-lat').innerText = cam.lat;
    document.getElementById('tel-lng').innerText = cam.lng;
    document.getElementById('tel-alt').innerText = cam.alt;
}

function updateClock() {
    const now = new Date();
    const time = now.toISOString().split('T')[1].split('.')[0];
    document.getElementById('utc-clock').innerText = time;
}

window.onload = init;
EOF
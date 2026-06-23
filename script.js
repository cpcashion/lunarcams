document.addEventListener('DOMContentLoaded', () => {
    // Simulated live telemetry updates
    const altValue = document.querySelector('.telemetry div:nth-child(1)');
    const latValue = document.querySelector('.telemetry div:nth-child(2)');
    const signalValue = document.querySelector('.signal');

    setInterval(() => {
        const alt = (Math.random() * 0.05).toFixed(2);
        const lat = (43.37 + (Math.random() - 0.5) * 0.01).toFixed(4);
        
        altValue.innerText = `ALT: ${alt}m`;
        latValue.innerText = `LAT: ${lat}° S`;
        
        // Signal flickering
        const signalStrength = Math.floor(Math.random() * 2) + 3; // 3 or 4 bars
        const bars = '█'.repeat(signalStrength) + '░'.repeat(5 - signalStrength);
        signalValue.innerText = `SIG: ${bars} ${80 + Math.floor(Math.random() * 10)}%`;
    }, 2000);

    // Smooth hover effect for cards
    const cards = document.querySelectorAll('.cam-card');
    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
    });
});

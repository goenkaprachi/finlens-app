const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:8000' 
    : ''; // On Render, it's relative if hosted together, but we deploy separately. Wait, we should use a relative path if deployed on same domain, or inject it. For now, assume localhost:8000 for local.

// The guide says we can use env vars for Vercel, but for local it's 8000.
// In production on Render, point to the deployed backend
const BASE_URL = 'https://finlens-api.onrender.com';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await Promise.all([
            fetchSummary(),
            fetchMarginJoin(),
            fetchRevenueAtRisk(),
            fetchPricing()
        ]);
        document.getElementById('refresh-badge').innerHTML = '✅ Synced just now';
        document.getElementById('refresh-badge').style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
        document.getElementById('refresh-badge').style.color = '#10b981';
    } catch (e) {
        console.error(e);
        document.getElementById('refresh-badge').innerHTML = '⚠️ Sync Failed';
        document.getElementById('refresh-badge').style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
        document.getElementById('refresh-badge').style.color = '#ef4444';
    }
});

async function fetchSummary() {
    const res = await fetch(`${BASE_URL}/api/summary`);
    const data = await res.json();
    
    document.getElementById('sidebar-metrics').innerHTML = `
        <div class="metric-row">
            <span class="metric-label">Total SKUs</span>
            <span>${data.total_skus}</span>
        </div>
        <div class="metric-row">
            <span class="metric-label">Prices Scraped</span>
            <span style="color: var(--success)">${data.scraped_count}</span>
        </div>
        <div class="metric-row">
            <span class="metric-label">Stale/Missing</span>
            <span style="color: var(--warning)">${data.stale_count}</span>
        </div>
        <div class="metric-row" style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border)">
            <span class="metric-label" style="color: var(--danger); font-weight: 600">Margin Alerts</span>
            <span style="color: var(--danger); font-weight: 600">${data.flagged_count}</span>
        </div>
    `;
}

async function fetchMarginJoin() {
    const res = await fetch(`${BASE_URL}/api/margin-join`);
    const data = await res.json();
    const container = document.getElementById('margin-cards');
    
    if (data.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted)">No SKUs currently match the alert criteria.</p>';
        return;
    }
    
    container.innerHTML = data.map(item => `
        <div class="card">
            <div class="card-header">
                <span class="card-sku">${item.SKU}</span>
                <span class="card-tag">OVERPRICED</span>
            </div>
            <div class="card-product">${item['Product Name']}</div>
            
            <div class="card-stats">
                <div class="stat">
                    <span class="stat-val">₹${item['Our Price']}</span>
                    <span class="stat-lbl">Our Price</span>
                </div>
                <div class="stat">
                    <span class="stat-val" style="color: var(--accent)">₹${item['Competitor Price']}</span>
                    <span class="stat-lbl">Market Price</span>
                </div>
            </div>
            
            <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border)">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-size: 0.85rem; color: var(--text-muted)">Margin Trend (3mo)</span>
                    <span style="font-size: 0.85rem; font-weight: 600; color: var(--danger)">${parseFloat(item['Trend Slope']).toFixed(2)} pts/mo</span>
                </div>
                <!-- Simple CSS Sparkline concept -->
                <div style="display: flex; align-items: flex-end; height: 30px; gap: 4px;">
                    <div style="flex: 1; background: var(--danger); opacity: 0.5; height: ${item['Apr Margin']*100}%" title="Apr: ${(item['Apr Margin']*100).toFixed(1)}%"></div>
                    <div style="flex: 1; background: var(--danger); opacity: 0.7; height: ${item['May Margin']*100}%" title="May: ${(item['May Margin']*100).toFixed(1)}%"></div>
                    <div style="flex: 1; background: var(--danger); opacity: 1; height: ${item['Jun Margin']*100}%" title="Jun: ${(item['Jun Margin']*100).toFixed(1)}%"></div>
                </div>
            </div>
        </div>
    `).join('');
}

async function fetchRevenueAtRisk() {
    const res = await fetch(`${BASE_URL}/api/revenue-at-risk`);
    const data = await res.json();
    const tbody = document.querySelector('#revenue-table tbody');
    
    tbody.innerHTML = data.map(item => {
        // Handle potential missing data gracefully
        if (!item.SKU || item.SKU === 'None') return '';
        
        return `
        <tr>
            <td><strong>${item.SKU}</strong></td>
            <td>${item['June Units'] || '-'}</td>
            <td>${item['June Margin %'] ? (item['June Margin %'] * 100).toFixed(1) + '%' : '-'}</td>
            <td>₹${item['Implied Unit Cost (INR)'] ? parseFloat(item['Implied Unit Cost (INR)']).toFixed(2) : '-'}</td>
            <td>₹${item['Competitor Price (INR)'] || '-'}</td>
            <td style="color: var(--danger); font-weight: 600">
                ₹${item['Monthly Profit Swing (INR)'] ? parseFloat(item['Monthly Profit Swing (INR)']).toFixed(2) : '-'}
            </td>
        </tr>
    `}).join('');
}

async function fetchPricing() {
    const res = await fetch(`${BASE_URL}/api/pricing`);
    const data = await res.json();
    const tbody = document.querySelector('#pricing-table tbody');
    
    tbody.innerHTML = data.map(item => {
        const isStale = item['Scraped At (UTC)'] === 'STALE';
        const statusHtml = isStale 
            ? `<span class="tag tag-stale">⚠ STALE</span>`
            : `<a href="${item['Listing URL']}" target="_blank" class="source-link tag tag-live">View Source ↗</a>`;
            
        let deltaHtml = '-';
        if (item['Price Delta %'] && item['Price Delta %'] !== 'No competitor data') {
            // Formula in excel is string, backend sends it raw. Oh wait, backend sends the raw string '=(D2-E2)/E2'.
            // Actually, pandas reads the formula if data_only=False, but openpyxl reads cached value if data_only=True.
            // Let's handle if it's a string vs number.
            let delta = item['Price Delta %'];
            if (typeof delta === 'number') {
                deltaHtml = `<span class="${delta > 0 ? 'delta-neg' : 'delta-pos'}">${(delta*100).toFixed(1)}%</span>`;
            } else if (typeof delta === 'string' && delta.startsWith('=')) {
                // We should compute it here if pandas sent the formula
                const our = parseFloat(item['Our Price (INR)']);
                const comp = parseFloat(item['Competitor Price (INR)']);
                if (our && comp) {
                    const calc = ((our - comp) / comp) * 100;
                    deltaHtml = `<span class="${calc > 0 ? 'delta-neg' : 'delta-pos'}">${calc.toFixed(1)}%</span>`;
                } else {
                    deltaHtml = delta;
                }
            } else {
                deltaHtml = delta;
            }
        }
        
        return `
        <tr>
            <td><strong>${item.SKU}</strong></td>
            <td>${item['Product Name']}</td>
            <td>₹${item['Our Price (INR)']}</td>
            <td>${item['Competitor Price (INR)'] === 'N/A' || !item['Competitor Price (INR)'] ? '-' : '₹'+item['Competitor Price (INR)']}</td>
            <td>${deltaHtml}</td>
            <td>${statusHtml}</td>
        </tr>
    `}).join('');
}

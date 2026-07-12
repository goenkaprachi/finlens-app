import pandas as pd
import os

EXCEL_FILE = os.path.join(os.path.dirname(__file__), 'competitor_margin_analysis.xlsx')

def get_pricing():
    df = pd.read_excel(EXCEL_FILE, sheet_name='Price Delta')
    # Filter out empty rows or notes
    df = df.dropna(subset=['SKU'])
    
    # Process "Scraped At (UTC)" to handle None values
    df['Scraped At (UTC)'] = df['Scraped At (UTC)'].fillna('STALE')
    
    # Replace NaNs with None for JSON compliance robustly
    records = df.to_dict('records')
    for r in records:
        for k, v in r.items():
            if pd.isna(v):
                r[k] = None
                
    return records

def get_margin_join():
    df_margin = pd.read_excel(EXCEL_FILE, sheet_name='Margin Trend (Last 3mo)')
    df_delta = pd.read_excel(EXCEL_FILE, sheet_name='Price Delta')
    
    # Filter empty rows
    df_margin = df_margin.dropna(subset=['SKU'])
    df_delta = df_delta.dropna(subset=['SKU'])
    
    # Find flagged SKUs: Declining Flag == 'DECLINING' in Margin sheet
    declining_skus = df_margin[df_margin['Declining Flag'] == 'DECLINING']['SKU'].tolist()
    
    # Find overpriced SKUs: Above Market >10%? == 'YES' in Delta sheet
    overpriced_skus = df_delta[df_delta['Above Market >10%?'] == 'YES']['SKU'].tolist()
    
    # Intersection
    flagged_skus = list(set(declining_skus) & set(overpriced_skus))
    
    results = []
    for sku in flagged_skus:
        margin_row = df_margin[df_margin['SKU'] == sku].iloc[0]
        delta_row = df_delta[df_delta['SKU'] == sku].iloc[0]
        
        results.append({
            'SKU': sku,
            'Product Name': delta_row['Product Name'],
            'Our Price': delta_row['Our Price (INR)'],
            'Competitor Price': delta_row['Competitor Price (INR)'],
            'Delta %': delta_row['Price Delta %'],
            'Apr Margin': margin_row['Apr-2026 Margin %'],
            'May Margin': margin_row['May-2026 Margin %'],
            'Jun Margin': margin_row['Jun-2026 Margin %'],
            'Trend Slope': margin_row['Slope (pts/month)']
        })
    
    return results

def get_revenue_at_risk():
    df = pd.read_excel(EXCEL_FILE, sheet_name='Revenue at Risk')
    df = df.dropna(subset=['SKU'])
    # Remove rows that are just notes
    df = df[~df['SKU'].str.contains('Cross-reference', na=False, case=False)]
    df = df[~df['SKU'].str.contains('Presented as evidence', na=False, case=False)]
    
    # Replace NaNs with None for JSON compliance robustly
    records = df.to_dict('records')
    for r in records:
        for k, v in r.items():
            if pd.isna(v):
                r[k] = None
                
    return records

def get_summary():
    pricing = get_pricing()
    total_skus = len(pricing)
    stale_count = sum(1 for p in pricing if pd.isna(p.get('Competitor Price (INR)')) or p.get('Competitor Price (INR)') == 'N/A')
    scraped_count = total_skus - stale_count
    flagged_count = len(get_margin_join())
    
    return {
        'total_skus': total_skus,
        'scraped_count': scraped_count,
        'stale_count': stale_count,
        'flagged_count': flagged_count
    }

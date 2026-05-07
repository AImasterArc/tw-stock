import React, { useState, useEffect } from 'react';
import StockChart from '../components/StockChart';

interface Props {
  data: any;
}

const Page3: React.FC<Props> = ({ data }) => {
  const top20 = data.top_20_volume || [];
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [selectedStock, setSelectedStock] = useState<any>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="page-container fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h2>成值排行前 20 名個股</h2>
          <p>市場最熱門、資金聚集的個股動態，並已排除自定義的黑名單。</p>
        </div>
        {isMobile && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '12px', marginTop: '4px' }}>
            更新: {new Date(data.last_updated).toLocaleString('zh-TW', { hour12: false, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
      
      {!isMobile ? (
        // 桌上型電腦版：顯示完整的 K 線圖列表
        <div className="stock-list">
          {top20.map((stock: any, index: number) => (
            <StockChart 
              key={index}
              data={stock.chart} 
              title={`第 ${stock.rank} 名 - ${stock.name} (${stock.ticker})`} 
              type="candlestick" 
              showVolume={true}
              institutionalData={stock.institutional}
            />
          ))}
        </div>
      ) : (
        // 手機版：顯示超流暢的高質感行情列表
        <div className="stock-list-container">
          {top20.map((stock: any, index: number) => {
            const chartData = stock.chart || [];
            const latestCandle = chartData[chartData.length - 1];
            const prevCandle = chartData[chartData.length - 2];
            
            const closePrice = latestCandle?.close || 0;
            const prevClose = prevCandle?.close || closePrice;
            const changeAmt = closePrice - prevClose;
            const changePercent = prevClose !== 0 ? (changeAmt / prevClose) * 100 : 0;
            const volumeVal = latestCandle?.volume || 0;

            const isUp = changeAmt > 0;
            const isDown = changeAmt < 0;
            const changeClass = isUp ? 'up' : (isDown ? 'down' : 'flat');
            const sign = isUp ? '+' : '';

            // 格式化成交量為張數 (台股通常除以 1000 為張，但有些資料已是張數，在此做適度展示)
            const displayVol = volumeVal >= 1000 ? `${Math.round(volumeVal / 1000).toLocaleString()}張` : `${volumeVal.toLocaleString()}股`;

            return (
              <div 
                key={index} 
                className="stock-row-card"
                onClick={() => setSelectedStock(stock)}
              >
                <div className="stock-row-left">
                  <div className={`stock-row-rank top-rank-${stock.rank}`}>{stock.rank}</div>
                  <div className="stock-row-info">
                    <span className="stock-row-name">{stock.name}</span>
                    <span className="stock-row-ticker">{stock.ticker}</span>
                  </div>
                </div>
                
                <div className="stock-row-right">
                  <div className="stock-row-price-section">
                    <span className="stock-row-price" style={{ color: isUp ? 'var(--up-color)' : (isDown ? 'var(--down-color)' : 'var(--text-main)') }}>
                      {closePrice.toFixed(2)}
                    </span>
                    <span className={`stock-row-change ${changeClass}`}>
                      {sign}{changeAmt.toFixed(2)} ({sign}{changePercent.toFixed(2)}%)
                    </span>
                  </div>
                  <div className="stock-row-vol-section">
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>日成交量</span>
                    <span>{displayVol}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 手機版：抽屜式圖表詳細面板 (Bottom Sheet Drawer) */}
      <div className={`modal-overlay ${selectedStock ? 'active' : ''}`} onClick={() => setSelectedStock(null)}>
        <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="bottom-sheet-drag-handle" />
          <div className="bottom-sheet-header">
            <span className="bottom-sheet-title">K線與籌碼同步圖表</span>
            <button className="bottom-sheet-close-btn" onClick={() => setSelectedStock(null)}>關閉</button>
          </div>
          {selectedStock && (
            <div style={{ marginTop: '10px' }}>
              <StockChart 
                data={selectedStock.chart} 
                title={`第 ${selectedStock.rank} 名 - ${selectedStock.name} (${selectedStock.ticker})`} 
                type="candlestick" 
                showVolume={true}
                institutionalData={selectedStock.institutional}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Page3;

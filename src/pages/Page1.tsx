import React, { useState, useEffect } from 'react';
import StockChart from '../components/StockChart';

interface Props {
  data: any;
}

const Page1: React.FC<Props> = ({ data }) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="page-container fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h2>大盤與櫃買指數</h2>
          <p>觀察整體台股市場資金動向與趨勢</p>
        </div>
        {isMobile && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '12px', marginTop: '4px' }}>
            更新: {new Date(data.last_updated).toLocaleString('zh-TW', { hour12: false, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
      
      {data.indices?.TAEX && data.indices.TAEX.length > 0 && (
        <StockChart 
          data={data.indices.TAEX} 
          title="加權指數 (TAEX)" 
          type="candlestick" 
          showVolume={true} 
        />
      )}
      
      {data.indices?.TPEx && data.indices.TPEx.length > 0 && (
        <StockChart 
          data={data.indices.TPEx} 
          title="櫃買指數 (TPEx)" 
          type="candlestick" 
          showVolume={true} 
        />
      )}
    </div>
  );
};

export default Page1;

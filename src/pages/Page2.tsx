import React, { useState } from 'react';
import StockChart from '../components/StockChart';

interface Props {
  data: any;
}

const Page2: React.FC<Props> = ({ data }) => {
  const sheetStocks = data.sheet_stocks || {};
  const industries = Object.keys(sheetStocks);
  const [activeTab, setActiveTab] = useState<string>(industries[0] || '');

  if (industries.length === 0) {
    return <div className="page-container fade-in">尚無產業個股資料</div>;
  }

  const currentStocks = sheetStocks[activeTab] || [];

  return (
    <div className="page-container fade-in">
      <div className="page-header">
        <h2>產業分類個股追蹤</h2>
        <p>依據 Google Sheet 來源，顯示各產業個股技術線圖與外資投信買賣超變化</p>
      </div>
      
      <div className="tabs">
        {industries.map(ind => (
          <button 
            key={ind} 
            className={`tab-btn ${activeTab === ind ? 'active' : ''}`}
            onClick={() => setActiveTab(ind)}
          >
            {ind}
          </button>
        ))}
      </div>

      <div className="stock-list">
        {currentStocks.map((stock: any, index: number) => (
          <StockChart 
            key={index}
            data={stock.chart} 
            title={`${stock.name} (${stock.ticker})`} 
            type="candlestick" 
            showVolume={true}
            institutionalData={stock.institutional}
          />
        ))}
      </div>
    </div>
  );
};

export default Page2;

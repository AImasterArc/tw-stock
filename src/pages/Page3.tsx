import React from 'react';
import StockChart from '../components/StockChart';

interface Props {
  data: any;
}

const Page3: React.FC<Props> = ({ data }) => {
  const top20 = data.top_20_volume || [];

  return (
    <div className="page-container fade-in">
      <div className="page-header">
        <h2>成值排行前 20 名個股</h2>
        <p>市場最熱門、資金聚集的個股動態，並已排除自定義的黑名單。</p>
      </div>
      
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
    </div>
  );
};

export default Page3;

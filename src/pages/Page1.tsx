import React from 'react';
import StockChart from '../components/StockChart';

interface Props {
  data: any;
}

const Page1: React.FC<Props> = ({ data }) => {
  return (
    <div className="page-container fade-in">
      <div className="page-header">
        <h2>大盤與櫃買指數</h2>
        <p>觀察整體台股市場資金動向與趨勢</p>
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

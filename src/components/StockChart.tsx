import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import type { ISeriesApi, MouseEventParams } from 'lightweight-charts';

interface ChartProps {
  data: any[];
  title: string;
  type?: 'candlestick' | 'line';
  showVolume?: boolean;
  institutionalData?: any[];
}

interface InstStats {
  foreignChange: number;
  foreignTotal: number;
  trustChange: number;
  trustTotal: number;
  date: string;
}

const getInstStatsForDate = (targetDate: string, instData?: any[]): InstStats | null => {
  if (!instData || instData.length === 0) return null;
  
  let idx = instData.findIndex(d => d.time === targetDate);
  if (idx === -1) {
    for (let i = instData.length - 1; i >= 0; i--) {
      if (instData[i].time <= targetDate) {
        idx = i;
        break;
      }
    }
  }
  
  if (idx === -1) return null;

  // Find a day with non-zero info starting from idx backwards
  let activeIdx = idx;
  while (activeIdx >= 0) {
    const item = instData[activeIdx];
    if ((item.foreign && item.foreign !== 0) || (item.trust && item.trust !== 0)) {
      break;
    }
    activeIdx--;
  }

  if (activeIdx < 0) return null;

  // Cumulative sum up to activeIdx
  let foreignTotal = 0;
  let trustTotal = 0;
  for (let i = 0; i <= activeIdx; i++) {
    foreignTotal += instData[i].foreign || 0;
    trustTotal += instData[i].trust || 0;
  }

  const activeItem = instData[activeIdx];
  return {
    foreignChange: activeItem.foreign || 0,
    foreignTotal,
    trustChange: activeItem.trust || 0,
    trustTotal,
    date: activeItem.time
  };
};

const formatInstString = (stats: InstStats | null, type: 'foreign' | 'trust') => {
  if (!stats) return '<Unknown>';
  const changeShares = type === 'foreign' ? stats.foreignChange : stats.trustChange;
  const changeLots = changeShares / 1000;
  
  const sign = changeLots > 0 ? '+' : '';
  return `${sign}${Math.round(changeLots).toLocaleString()}張`;
};

const StockChart = ({ data, title, type = 'candlestick', showVolume = false, institutionalData }: ChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const subChartContainerRef1 = useRef<HTMLDivElement>(null); // 外資副圖
  const subChartContainerRef2 = useRef<HTMLDivElement>(null); // 投信副圖
  const hasInst = institutionalData && institutionalData.length > 0;
  
  // Legend state
  const [legend, setLegend] = useState<{
    date: string;
    ma5: string; ma10: string; ma20: string; ma60: string;
    vol: string;
    foreign: string; trust: string;
  }>({
    date: '', ma5: '', ma10: '', ma20: '', ma60: '', vol: '', foreign: '', trust: ''
  });

  useEffect(() => {
    if (!chartContainerRef.current || !data || data.length === 0) return;

    let subChart1: any = null;
    let subChart2: any = null;
    let foreignSeries: any = null;
    let trustSeries: any = null;

    const handleResize = () => {
      const clientWidth = chartContainerRef.current?.clientWidth;
      if (clientWidth) {
        chart.applyOptions({ width: clientWidth });
        if (subChart1) subChart1.applyOptions({ width: clientWidth });
        if (subChart2) subChart2.applyOptions({ width: clientWidth });
      }
    };

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 300,
      timeScale: {
        visible: !hasInst, // 如果有副圖表，則隱藏主圖表的時間軸
        borderColor: 'rgba(255, 255, 255, 0.1)',
        tickMarkFormatter: (time: any) => {
          if (typeof time === 'string') {
            const parts = time.split('-');
            if (parts.length >= 2) return `${parts[1]}月`;
          } else if (time && time.month) {
            return `${time.month}月`;
          }
          return String(time);
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        visible: true,
        minimumWidth: 80, // 確保主副圖寬度完全對齊
      },
      leftPriceScale: {
        visible: false,
      }
    });

    let volumeSeries: ISeriesApi<any> | null = null;
    if (showVolume) {
      volumeSeries = chart.addHistogramSeries({
        color: 'rgba(96, 165, 250, 0.3)',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: '', 
        lastValueVisible: false,
        priceLineVisible: false,
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.5,
          bottom: 0, 
        },
      });
      const volumeData = data.map(d => ({
        time: d.time,
        value: d.volume || 0,
      }));
      volumeSeries.setData(volumeData);
    }

    let mainSeries: ISeriesApi<any>;

    if (type === 'candlestick') {
      mainSeries = chart.addCandlestickSeries({
        upColor: '#ef4444',
        downColor: '#22c55e',
        borderVisible: false,
        wickUpColor: '#ef4444',
        wickDownColor: '#22c55e',
      });
      mainSeries.setData(data);
    } else {
      mainSeries = chart.addLineSeries({
        color: '#3b82f6',
        lineWidth: 2,
      });
      mainSeries.setData(data.map(d => ({ time: d.time, value: d.close })));
    }

    const maColors = {
      ma5: '#facc15',
      ma10: '#f472b6',
      ma20: '#2dd4bf',
      ma60: '#a78bfa',
    };

    const maSeriesMap: Record<string, ISeriesApi<any>> = {};

    ['ma5', 'ma10', 'ma20', 'ma60'].forEach((maKey) => {
      const maData = data
        .filter(d => d[maKey] !== null && d[maKey] !== undefined)
        .map(d => ({ time: d.time, value: d[maKey] }));
        
      if (maData.length > 0) {
        const maSeries = chart.addLineSeries({
          color: maColors[maKey as keyof typeof maColors],
          lineWidth: 1,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        });
        maSeries.setData(maData);
        maSeriesMap[maKey] = maSeries;
      }
    });

    // 初始化副圖表：外資與投信變化量（分成兩個副圖，用柱狀圖顯示，比例尺一致）
    if (hasInst && subChartContainerRef1.current && subChartContainerRef2.current) {
      // 1. 計算兩邊比例尺一致的對稱 Min/Max (以張數為單位)
      const fLots = institutionalData.map(item => (item.foreign || 0) / 1000);
      const tLots = institutionalData.map(item => (item.trust || 0) / 1000);
      const allLots = [...fLots, ...tLots];
      const absMax = Math.max(...allLots.map(Math.abs));
      const sharedMax = absMax > 0 ? absMax * 1.15 : 100;
      const sharedMin = -sharedMax;

      // 2. 建立外資副圖表 subChart1
      subChart1 = createChart(subChartContainerRef1.current, {
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: '#94a3b8',
        },
        grid: {
          vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
          horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
        },
        width: subChartContainerRef1.current.clientWidth,
        height: 100,
        timeScale: {
          visible: false, // 隱藏中間圖的時間軸
          borderColor: 'rgba(255, 255, 255, 0.1)',
        },
        rightPriceScale: {
          borderColor: 'rgba(255, 255, 255, 0.1)',
          visible: true,
          minimumWidth: 80, // 與主圖寬度完美對齊
        },
        leftPriceScale: {
          visible: false,
        }
      });

      foreignSeries = subChart1.addHistogramSeries({
        priceFormat: {
          type: 'volume',
        },
        autoscaleInfoProvider: () => ({
          priceRange: {
            minValue: sharedMin,
            maxValue: sharedMax,
          },
        }),
        lastValueVisible: false,
        priceLineVisible: false,
      });

      const fData = institutionalData.map(item => {
        const val = (item.foreign || 0) / 1000;
        return {
          time: item.time,
          value: val,
          color: val > 0 ? '#ef4444' : (val < 0 ? '#22c55e' : '#94a3b8')
        };
      });
      foreignSeries.setData(fData);

      foreignSeries.createPriceLine({
        price: 0,
        color: 'rgba(255, 255, 255, 0.25)',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: false,
        title: '外資 (張)',
      });

      // 3. 建立投信副圖表 subChart2
      subChart2 = createChart(subChartContainerRef2.current, {
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: '#94a3b8',
        },
        grid: {
          vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
          horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
        },
        width: subChartContainerRef2.current.clientWidth,
        height: 110, // 稍微高一點點保留給時間軸刻度
        timeScale: {
          visible: true, // 最底下的副圖顯露時間軸
          borderColor: 'rgba(255, 255, 255, 0.1)',
          tickMarkFormatter: (time: any) => {
            if (typeof time === 'string') {
              const parts = time.split('-');
              if (parts.length >= 2) return `${parts[1]}月`;
            } else if (time && time.month) {
              return `${time.month}月`;
            }
            return String(time);
          },
        },
        rightPriceScale: {
          borderColor: 'rgba(255, 255, 255, 0.1)',
          visible: true,
          minimumWidth: 80, // 與主圖、外資副圖寬度完美對齊
        },
        leftPriceScale: {
          visible: false,
        }
      });

      trustSeries = subChart2.addHistogramSeries({
        priceFormat: {
          type: 'volume',
        },
        autoscaleInfoProvider: () => ({
          priceRange: {
            minValue: sharedMin,
            maxValue: sharedMax,
          },
        }),
        lastValueVisible: false,
        priceLineVisible: false,
      });

      const tData = institutionalData.map(item => {
        const val = (item.trust || 0) / 1000;
        return {
          time: item.time,
          value: val,
          color: val > 0 ? '#ef4444' : (val < 0 ? '#22c55e' : '#94a3b8')
        };
      });
      trustSeries.setData(tData);

      trustSeries.createPriceLine({
        price: 0,
        color: 'rgba(255, 255, 255, 0.25)',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: false,
        title: '投信 (張)',
      });

      // 4. 三張圖表時間軸 100% 同步滾動與縮放
      let isSyncing = false;
      const syncCharts = (range: any, excludeScale: any) => {
        if (isSyncing) return;
        isSyncing = true;

        const scales = [chart.timeScale()];
        if (subChart1) scales.push(subChart1.timeScale());
        if (subChart2) scales.push(subChart2.timeScale());

        scales.forEach(scale => {
          if (scale !== excludeScale) {
            scale.setVisibleLogicalRange(range);
          }
        });

        isSyncing = false;
      };

      chart.timeScale().subscribeVisibleLogicalRangeChange((range: any) => {
        syncCharts(range, chart.timeScale());
      });

      subChart1.timeScale().subscribeVisibleLogicalRangeChange((range: any) => {
        syncCharts(range, subChart1.timeScale());
      });

      subChart2.timeScale().subscribeVisibleLogicalRangeChange((range: any) => {
        syncCharts(range, subChart2.timeScale());
      });
    }

    const onCrosshairMove = (param: MouseEventParams, originChart: 'chart' | 'subChart1' | 'subChart2') => {
      const time = param.time;

      // 1. 同步其餘圖表的游標
      if (param.sourceEvent) {
        if (originChart === 'chart') {
          if (subChart1 && foreignSeries) {
            if (time) subChart1.setCrosshairPosition(0, time, foreignSeries);
            else subChart1.clearCrosshairPosition();
          }
          if (subChart2 && trustSeries) {
            if (time) subChart2.setCrosshairPosition(0, time, trustSeries);
            else subChart2.clearCrosshairPosition();
          }
        } else if (originChart === 'subChart1') {
          if (chart && mainSeries) {
            if (time) chart.setCrosshairPosition(0, time, mainSeries);
            else chart.clearCrosshairPosition();
          }
          if (subChart2 && trustSeries) {
            if (time) subChart2.setCrosshairPosition(0, time, trustSeries);
            else subChart2.clearCrosshairPosition();
          }
        } else if (originChart === 'subChart2') {
          if (chart && mainSeries) {
            if (time) chart.setCrosshairPosition(0, time, mainSeries);
            else chart.clearCrosshairPosition();
          }
          if (subChart1 && foreignSeries) {
            if (time) subChart1.setCrosshairPosition(0, time, foreignSeries);
            else subChart1.clearCrosshairPosition();
          }
        }
      }

      // 2. 更新 Legend 數據
      if (param.time) {
        const dataItem = data.find(d => d.time === param.time);
        const instStats = getInstStatsForDate(String(param.time), institutionalData);
        
        if (dataItem) {
          setLegend({
            date: String(param.time),
            ma5: dataItem.ma5 ? dataItem.ma5.toFixed(2) : '',
            ma10: dataItem.ma10 ? dataItem.ma10.toFixed(2) : '',
            ma20: dataItem.ma20 ? dataItem.ma20.toFixed(2) : '',
            ma60: dataItem.ma60 ? dataItem.ma60.toFixed(2) : '',
            vol: dataItem.volume ? dataItem.volume.toLocaleString() : '0',
            foreign: formatInstString(instStats, 'foreign'),
            trust: formatInstString(instStats, 'trust'),
          });
        }
      } else {
        const lastItem = data[data.length - 1];
        if (lastItem) {
          const instStats = getInstStatsForDate(lastItem.time, institutionalData);
          setLegend({
            date: lastItem.time,
            ma5: lastItem.ma5 ? lastItem.ma5.toFixed(2) : '',
            ma10: lastItem.ma10 ? lastItem.ma10.toFixed(2) : '',
            ma20: lastItem.ma20 ? lastItem.ma20.toFixed(2) : '',
            ma60: lastItem.ma60 ? lastItem.ma60.toFixed(2) : '',
            vol: lastItem.volume ? lastItem.volume.toLocaleString() : '0',
            foreign: formatInstString(instStats, 'foreign'),
            trust: formatInstString(instStats, 'trust'),
          });
        }
      }
    };

    chart.subscribeCrosshairMove((p: any) => onCrosshairMove(p, 'chart'));
    if (subChart1) {
      subChart1.subscribeCrosshairMove((p: any) => onCrosshairMove(p, 'subChart1'));
    }
    if (subChart2) {
      subChart2.subscribeCrosshairMove((p: any) => onCrosshairMove(p, 'subChart2'));
    }

    // 初始化 Legend
    const lastItem = data[data.length - 1];
    if (lastItem) {
      const instStats = getInstStatsForDate(lastItem.time, institutionalData);
      setLegend({
        date: lastItem.time,
        ma5: lastItem.ma5 ? lastItem.ma5.toFixed(2) : '',
        ma10: lastItem.ma10 ? lastItem.ma10.toFixed(2) : '',
        ma20: lastItem.ma20 ? lastItem.ma20.toFixed(2) : '',
        ma60: lastItem.ma60 ? lastItem.ma60.toFixed(2) : '',
        vol: lastItem.volume ? lastItem.volume.toLocaleString() : '0',
        foreign: formatInstString(instStats, 'foreign'),
        trust: formatInstString(instStats, 'trust'),
      });
    }

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      if (subChart1) {
        subChart1.remove();
      }
      if (subChart2) {
        subChart2.remove();
      }
    };
  }, [data, type, showVolume, institutionalData, hasInst]);

  const latestData = data && data.length > 0 ? data[data.length - 1] : null;
  const prevData = data && data.length > 1 ? data[data.length - 2] : null;

  let changePercent = 0;
  let changeAmt = 0;
  if (latestData && prevData) {
    changeAmt = latestData.close - prevData.close;
    changePercent = (changeAmt / prevData.close) * 100;
  }

  const brokenMAs = [];
  if (latestData) {
    if (latestData.ma5 && latestData.close < latestData.ma5) brokenMAs.push('MA5');
    if (latestData.ma10 && latestData.close < latestData.ma10) brokenMAs.push('MA10');
    if (latestData.ma20 && latestData.close < latestData.ma20) brokenMAs.push('MA20');
    if (latestData.ma60 && latestData.close < latestData.ma60) brokenMAs.push('MA60');
  }

  return (
    <div className="card" style={{ position: 'relative' }}>
      <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', paddingBottom: '12px', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{title}</span>
        {latestData && (
          <div style={{ fontSize: '0.9rem', fontWeight: 'normal', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <span style={{ color: '#94a3b8', marginRight: '4px' }}>最新收盤:</span>
              <span style={{ color: changeAmt > 0 ? '#ef4444' : (changeAmt < 0 ? '#22c55e' : '#e2e8f0'), fontWeight: 'bold' }}>
                {latestData.close.toFixed(2)} 
                {' '}({changeAmt > 0 ? '+' : ''}{changeAmt.toFixed(2)}, {changePercent > 0 ? '+' : ''}{changePercent.toFixed(2)}%)
              </span>
            </div>
            
            {brokenMAs.length > 0 && (
              <div>
                <span style={{ color: '#94a3b8', marginRight: '4px' }}>跌破:</span>
                <span style={{ color: '#f59e0b', fontWeight: 'bold', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                  {brokenMAs.join(', ')}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* 絕對定位的 Legend (浮動在圖表左側) */}
      <div style={{
        position: 'absolute',
        top: '60px',
        left: '24px',
        zIndex: 10,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        fontSize: '0.85rem',
        background: 'rgba(15, 17, 26, 0.6)',
        padding: '8px',
        borderRadius: '8px',
        backdropFilter: 'blur(4px)'
      }}>
        <div style={{ color: '#e2e8f0', fontWeight: 'bold' }}>{legend.date}</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {legend.ma5 && <span style={{ color: '#facc15' }}>MA5: {legend.ma5}</span>}
          {legend.ma10 && <span style={{ color: '#f472b6' }}>MA10: {legend.ma10}</span>}
          {legend.ma20 && <span style={{ color: '#2dd4bf' }}>MA20: {legend.ma20}</span>}
          {legend.ma60 && <span style={{ color: '#a78bfa' }}>MA60: {legend.ma60}</span>}
        </div>
      </div>

      {/* 成交量與法人資訊的 Legend (浮動在成交量區域左側上方) */}
      {showVolume && (
        <div style={{
          position: 'absolute',
          bottom: '130px', /* 調整為成交量柱狀圖的上方位置 */
          left: '24px',
          zIndex: 10,
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          fontSize: '0.85rem',
          background: 'rgba(15, 17, 26, 0.6)',
          padding: '8px',
          borderRadius: '8px',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{ color: '#60a5fa' }}>成交量: {legend.vol}</div>
          {institutionalData && institutionalData.length > 0 && (
            <div style={{ display: 'flex', gap: '8px' }}>
              {legend.foreign && <span style={{ color: legend.foreign.includes('+') ? '#ef4444' : (legend.foreign.includes('-') ? '#22c55e' : '#e2e8f0') }}>外資: {legend.foreign}</span>}
              {legend.trust && <span style={{ color: legend.trust.includes('+') ? '#ef4444' : (legend.trust.includes('-') ? '#22c55e' : '#e2e8f0') }}>投信: {legend.trust}</span>}
            </div>
          )}
        </div>
      )}

      <div ref={chartContainerRef} className="chart-wrapper" style={{ height: '300px' }} />
      {hasInst && (
        <>
          <div 
            ref={subChartContainerRef1} 
            className="chart-wrapper" 
            style={{ height: '100px', marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)' }} 
          />
          <div 
            ref={subChartContainerRef2} 
            className="chart-wrapper" 
            style={{ height: '110px', marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)' }} 
          />
        </>
      )}
    </div>
  );
};

export default StockChart;

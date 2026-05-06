import os
import json
import requests
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta
import time

DATA_FILE = os.path.join("public", "data.json")
SHEET_URL = "https://docs.google.com/spreadsheets/d/1oSfXktWoF67uJtBqAS1sVqT41ftRSgH1JY_No-sR7wU/export?format=xlsx"

# 建立常用台股名稱與代號對照 (以防找不到)
NAME_TO_CODE = {
    "VRT": "VRT" # US Stock
}

def get_finmind_institutional(ticker, days=90):
    start_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    url = f"https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockInstitutionalInvestorsBuySell&data_id={ticker}&start_date={start_date}"
    try:
        res = requests.get(url, timeout=10)
        data = res.json().get("data", [])
        
        # 整理為 date -> {foreign: 0, trust: 0}
        inst_dict = {}
        for item in data:
            date = item["date"]
            name = item["name"]
            net_buy = item.get("buy", 0) - item.get("sell", 0)
            
            if date not in inst_dict:
                inst_dict[date] = {"foreign": 0, "trust": 0}
                
            if name in ['Foreign_Investor', 'Foreign_Dealer_Self']:
                inst_dict[date]["foreign"] += net_buy
            elif name == 'Investment_Trust':
                inst_dict[date]["trust"] += net_buy
                
        return inst_dict
    except Exception as e:
        print(f"FinMind API error for {ticker}: {e}")
        return {}

def get_yfinance_data(ticker, days=180, include_inst=False, pure_ticker=None):
    try:
        start_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        df = yf.download(ticker, start=start_date, progress=False)
        
        # 如果台股查無資料，嘗試換成櫃買中心 (.TWO)
        if df.empty and ticker.endswith(".TW"):
            ticker_two = ticker.replace(".TW", ".TWO")
            df = yf.download(ticker_two, start=start_date, progress=False)
            if not df.empty:
                ticker = ticker_two
                
        if df.empty:
            return [], [], ticker
        df = df.reset_index()
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = [c[0] for c in df.columns]
            
        # 計算均線
        df['MA5'] = df['Close'].rolling(window=5).mean()
        df['MA10'] = df['Close'].rolling(window=10).mean()
        df['MA20'] = df['Close'].rolling(window=20).mean()
        df['MA60'] = df['Close'].rolling(window=60).mean()
        
        # 如果需要籌碼資料且為台股
        inst_dict = {}
        if include_inst and pure_ticker and not pure_ticker.isalpha():
            inst_dict = get_finmind_institutional(pure_ticker, days=days)
            time.sleep(1) # 避免超過 FinMind 限速
        
        records = []
        inst_records = []
        
        for _, row in df.iterrows():
            date_str = row["Date"].strftime("%Y-%m-%d")
            records.append({
                "time": date_str,
                "open": float(row["Open"]),
                "high": float(row["High"]),
                "low": float(row["Low"]),
                "close": float(row["Close"]),
                "volume": float(row["Volume"]) if "Volume" in row else 0,
                "ma5": float(row["MA5"]) if pd.notna(row["MA5"]) else None,
                "ma10": float(row["MA10"]) if pd.notna(row["MA10"]) else None,
                "ma20": float(row["MA20"]) if pd.notna(row["MA20"]) else None,
                "ma60": float(row["MA60"]) if pd.notna(row["MA60"]) else None,
            })
            
            if include_inst and pure_ticker and not pure_ticker.isalpha():
                i_data = inst_dict.get(date_str, {"foreign": 0, "trust": 0})
                inst_records.append({
                    "time": date_str,
                    "foreign": i_data["foreign"],
                    "trust": i_data["trust"]
                })
        return records, inst_records, ticker
    except Exception as e:
        print(f"Error fetching {ticker}: {e}")
        return [], [], ticker

def fetch_data():
    data = {
        "last_updated": datetime.now().isoformat(),
        "indices": {},
        "sheet_stocks": {},
        "top_20_volume": []
    }
    
    # 1. 大盤與櫃買指數
    print("Fetching indices...")
    data["indices"]["TAEX"], _, _ = get_yfinance_data("^TWII", days=180)
    data["indices"]["TPEx"], _, _ = get_yfinance_data("^TWOII", days=180)
    
    # 補足今日大盤與櫃買指數 (Yahoo Finance 常有延遲)
    try:
        mis_res = requests.get('https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=otc_o00.tw|tse_t00.tw', timeout=10)
        mis_data = mis_res.json().get('msgArray', [])
        for item in mis_data:
            ticker_name = "TPEx" if item['c'] == 'o00' else "TAEX"
            if len(item.get('d', '')) == 8:
                date_str = f"{item['d'][:4]}-{item['d'][4:6]}-{item['d'][6:8]}"
                existing = [x for x in data["indices"][ticker_name] if x["time"] == date_str]
                if not existing and item.get('z') != '-':
                    data["indices"][ticker_name].append({
                        "time": date_str,
                        "open": float(item.get('o', item['y'])),
                        "high": float(item.get('h', item['y'])),
                        "low": float(item.get('l', item['y'])),
                        "close": float(item.get('z', item['y'])),
                        "volume": 0
                    })
    except Exception as e:
        print("Error fetching MIS TWSE for today's index:", e)
    
    # 2. 讀取 Google Sheet
    print("Fetching Google Sheet...")
    blacklist = []
    sheet1_stocks = set()
    try:
        sheets = pd.read_excel(SHEET_URL, sheet_name=None, header=None)
        
        # Sheet 2: 黑名單
        if '2' in sheets:
            df_black = sheets['2']
            blacklist = df_black[0].dropna().astype(str).tolist()
            print("Blacklist:", blacklist)
            
        # Sheet 1: 產業個股
        if '1' in sheets:
            df_sheet = sheets['1']
            sheet_stocks = {}
            for _, row in df_sheet.iterrows():
                if pd.isna(row[0]): continue
                industry = str(row[0])
                name = str(row[1])
                
                # 判斷股號
                if pd.notna(row[2]):
                    # xlsx 讀數字可能變成 float
                    code = str(row[2]).replace(".0", "")
                else:
                    code = NAME_TO_CODE.get(name, name)
                
                sheet1_stocks.add(name)
                sheet1_stocks.add(code)
                
                ticker = f"{code}.TW" if code.isdigit() else code
                
                if industry not in sheet_stocks:
                    sheet_stocks[industry] = []
                    
                print(f"Fetching {name} ({ticker})...")
                chart_data, inst_data, ticker = get_yfinance_data(ticker, include_inst=True, pure_ticker=code)
                
                sheet_stocks[industry].append({
                    "name": name,
                    "ticker": ticker,
                    "chart": chart_data,
                    "institutional": inst_data
                })
                
            data["sheet_stocks"] = sheet_stocks
    except Exception as e:
        print(f"Error processing Google Sheet: {e}")

    # 3. 成值前 20 名
    print("Fetching Top 20...")
    try:
        res = requests.get('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL', timeout=10)
        all_stocks = res.json()
        
        # First, sort ALL stocks to get their true market rank
        all_stocks_list = []
        for s in all_stocks:
            try:
                val = float(s.get('TradeValue', 0))
                code = s.get('Code', '')
                name = s.get('Name', '')
                if len(code) == 4 and code.isdigit():
                    all_stocks_list.append({"code": code, "name": name, "value": val})
            except:
                pass
                
        all_stocks_list.sort(key=lambda x: x["value"], reverse=True)
        
        # Now assign rank and filter
        valid_stocks = []
        for rank_idx, item in enumerate(all_stocks_list):
            item["rank"] = rank_idx + 1
            if item["name"] not in blacklist and item["code"] not in blacklist:
                if item["name"] not in sheet1_stocks and item["code"] not in sheet1_stocks:
                    valid_stocks.append(item)
                    
        top20 = valid_stocks[:20]
        
        for item in top20:
            print(f"Fetching Top20: #{item['rank']} {item['name']} ({item['code']})")
            ticker = f"{item['code']}.TW"
            chart_data, inst_data, ticker = get_yfinance_data(ticker, days=180, include_inst=True, pure_ticker=item['code'])
            data["top_20_volume"].append({
                "rank": item['rank'],
                "name": item['name'],
                "ticker": ticker,
                "chart": chart_data,
                "institutional": inst_data
            })
            
    except Exception as e:
        print(f"Error fetching top 20: {e}")

    # 寫入檔案
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("Data successfully saved to", DATA_FILE)

if __name__ == "__main__":
    fetch_data()

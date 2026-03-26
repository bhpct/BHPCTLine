// ==========================================
// 系統全域設定檔 (SaaS 開源共享版)
// 若要將系統部署至其他教會，只需修改此檔案即可！
// ==========================================

const CONFIG = {
    // 1. 教會/機構名稱 (將自動替換所有網頁的標題)
    CHURCH_NAME: "霧峰教會",
    
    // 2. LIFF ID (請至 LINE Developers Console 取得)
    LIFF_ID: "2009444508-qaGGdlps",
    
    // 3. GAS API 網址 (部署 Google Apps Script 後取得的網頁應用程式網址)
    GAS_URL: "https://script.google.com/macros/s/AKfycbwa4MCwa6_Uky7EkbUcghr-_ikexNIbdYZY23U3oysE4Kv6jendZafVbyXB1_2Cpqo-/exec",

    // 4. 前台快取時間設定 (預設 10 分鐘 = 10 * 60 * 1000 毫秒)
    CACHE_TTL: 600000 
};

// 為了向下相容原有的程式碼，將變數映射到全域 (請勿更動下方)
const myLiffId = CONFIG.LIFF_ID;
const GAS_URL = CONFIG.GAS_URL;
const CACHE_TTL = CONFIG.CACHE_TTL;
const CACHE_PREFIX = 'church_data_';

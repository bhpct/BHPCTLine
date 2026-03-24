// admin.js - 專屬於後台的輕量化邏輯，嚴格隔離以確保資訊安全

const myLiffId = '2009444508-qaGGdlps'; // 🚨 務必確認與前台相同
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwa4MCwa6_Uky7EkbUcghr-_ikexNIbdYZY23U3oysE4Kv6jendZafVbyXB1_2Cpqo-/exec';

let currentUID = ""; 
let adminData = null;

document.addEventListener("DOMContentLoaded", function() {
  const loadingEl = document.getElementById('loading');
  
  if (!myLiffId) {
    Swal.fire('系統錯誤', '未設定 LIFF ID！', 'error');
    loadingEl.style.display = 'none';
    return;
  }

  // 啟動 LIFF
  liff.init({ liffId: myLiffId })
    .then(() => {
      if (!liff.isLoggedIn()) {
        // 如果連 LINE 都沒登入，強制跳轉回前台，讓前台去處理登入
        window.location.href = 'index.html';
      } else {
        liff.getProfile().then(profile => {
          currentUID = profile.userId;
          verifyAdminAuth(currentUID); // 向 GAS 敲門，檢查是否為管理員
        }).catch(err => {
          Swal.fire('錯誤', '無法取得 LINE 帳號資料', 'error');
        });
      }
    })
    .catch((err) => {
      Swal.fire('錯誤', 'LIFF 啟動失敗', 'error');
    });
});

// 【核心門禁】驗證是否為管理員
function verifyAdminAuth(uid) {
  console.log("🛡️ 向伺服器驗證管理員權限中...");
  
  fetch(`${GAS_URL}?action=getUser&uid=${uid}`)
    .then(response => response.json())
    .then(response => {
      if (response.isAdmin) {
        // 驗證通過，解鎖後台介面
        adminData = response;
        document.getElementById('loading').style.display = 'none';
        document.getElementById('ui-adminName').innerText = `${response.name} (${response.adminLevel})`;
        console.log("✅ 歡迎進入霸王級後台");
      } else {
        // 拒絕訪問，遣返前台
        document.getElementById('loading').style.display = 'none';
        Swal.fire({
          title: '門禁管制',
          text: '抱歉，您沒有進入管理後台的權限喔！',
          icon: 'error',
          confirmButtonColor: '#8e44ad',
          confirmButtonText: '返回首頁',
          allowOutsideClick: false
        }).then(() => {
          window.location.href = 'index.html';
        });
      }
    })
    .catch(error => {
      Swal.fire('錯誤', '資料庫連線失敗！', 'error');
    });
}

// 後台專屬的 Tab 切換邏輯
function switchAdminTab(event, tabId) {
  event.preventDefault(); // 防止 a 標籤預設跳轉
  
  // 重置上方按鈕的樣式
  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
  event.currentTarget.classList.add('active');

  // 切換下方顯示區塊
  document.querySelectorAll('.admin-section').forEach(sec => sec.classList.remove('active'));
  document.getElementById('tab-' + tabId).classList.add('active');
}

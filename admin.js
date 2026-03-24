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
        
        // 【新增】載入儀表板數據
        loadDashboard();

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

// ==========================================
// 【新增】載入與渲染儀表板數據 (Tab 1)
// ==========================================
function loadDashboard() {
  const dashContainer = document.getElementById('tab-dashboard');
  dashContainer.innerHTML = '<div class="text-center my-5"><div class="spinner-border text-primary" style="color: #8e44ad !important;"></div><p class="mt-2 text-muted">讀取數據中...</p></div>';

  fetch(`${GAS_URL}?action=getAdminDashboard&uid=${currentUID}`)
    .then(res => res.json())
    .then(res => {
      if (res.success) {
        renderDashboard(res);
      } else {
        dashContainer.innerHTML = `<div class="alert alert-danger">${res.message}</div>`;
      }
    })
    .catch(err => {
      dashContainer.innerHTML = `<div class="alert alert-danger">連線失敗：${err.message}</div>`;
    });
}

function renderDashboard(data) {
  let html = `
    <div class="row mb-4">
      <div class="col-6">
        <div class="card p-3 text-center border-0 shadow-sm h-100" style="border-left: 4px solid #3498db !important;">
          <h6 class="text-muted mb-1" style="font-size: 0.8rem;"><i class="fas fa-users"></i> 總綁定會友</h6>
          <h3 class="fw-bold text-dark mb-0">${data.stats.totalMembers} <span style="font-size:0.8rem">人</span></h3>
        </div>
      </div>
      <div class="col-6">
        <div class="card p-3 text-center border-0 shadow-sm h-100" style="border-left: 4px solid #2ecc71 !important;">
          <h6 class="text-muted mb-1" style="font-size: 0.8rem;"><i class="fas fa-user-plus"></i> 本月新生</h6>
          <h3 class="fw-bold text-dark mb-0">${data.stats.newMembersThisMonth} <span style="font-size:0.8rem">人</span></h3>
        </div>
      </div>
    </div>
    
    <h6 class="fw-bold text-dark mb-3"><i class="fas fa-praying-hands text-warning"></i> 待處理代禱事項 <span class="badge bg-danger rounded-pill">${data.stats.pendingPrayerCount}</span></h6>
    <div class="list-group shadow-sm border-0 mb-4">
  `;
  
  if (data.pendingPrayers && data.pendingPrayers.length > 0) {
      data.pendingPrayers.forEach(p => {
          let badge = p.isPublic === "公開" ? `<span class="badge bg-info">公開</span>` : `<span class="badge bg-secondary">保密</span>`;
          html += `
            <div class="list-group-item p-3 border-0 border-bottom">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="fw-bold text-primary" style="font-size: 1.1rem;">${p.name}</span>
                <small class="text-muted">${p.time}</small>
              </div>
              <div class="mb-2 text-dark" style="font-size: 0.9rem;">
                ${badge} <strong class="ms-1">對象：</strong>${p.target}
              </div>
              <div class="mb-3 p-3 bg-light rounded text-dark" style="font-size: 0.95rem; white-space: pre-wrap; border-left: 3px solid #f39c12;">${p.content}</div>
              
              <div class="mt-2">
                <textarea id="reply-${p.rowId}" class="form-control mb-2" rows="2" placeholder="牧者勉勵回覆... (準備用於下一階段 LINE 推播)"></textarea>
                <button class="btn btn-sm btn-success rounded-pill w-100 fw-bold py-2" onclick="markPrayerDone(${p.rowId})">
                  <i class="fas fa-check"></i> 標記已代禱 (並儲存回覆)
                </button>
              </div>
            </div>
          `;
      });
  } else {
      html += `<div class="list-group-item p-4 text-center text-muted border-0">目前沒有未處理的代禱事項 🙏</div>`;
  }
  html += `</div>`;
  
  document.getElementById('tab-dashboard').innerHTML = html;
}

// ==========================================
// 【新增】標記代禱事項為已處理
// ==========================================
function markPrayerDone(rowId) {
  // 取得牧者可能輸入的回覆內容
  const replyText = document.getElementById(`reply-${rowId}`).value.trim();

  Swal.fire({
    title: '確認處理完畢？',
    html: replyText ? `即將標記為已處理，未來將透過 LINE 推播牧者勉勵。` : `目前無填寫勉勵，將直接標記為已代禱。`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#28a745',
    cancelButtonColor: '#6c757d',
    confirmButtonText: '是的，已處理'
  }).then((result) => {
    if (result.isConfirmed) {
      Swal.fire({ title: '處理中', text: '正在更新資料庫...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } });
      
      // 注意：這階段我們先呼叫標記 API，下一階段我們會把 LINE 推播功能整合進去
      fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'markPrayerDone', uid: currentUID, rowId: rowId, replyText: replyText })
      }).then(res => res.json()).then(res => {
        if (res.success) {
          Swal.fire('成功', res.message, 'success').then(() => {
            loadDashboard(); // 重新讀取儀表板
          });
        } else {
          Swal.fire('錯誤', res.message, 'error');
        }
      }).catch(err => {
        Swal.fire('連線錯誤', err.message, 'error');
      });
    }
  });
}

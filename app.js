window.onerror = function(msg, url, line) {
  if (typeof Swal !== 'undefined') {
    Swal.fire('系統錯誤', `請截圖回報。<br><span style="font-size:0.8rem;color:red;">${msg}<br>行數：${line}</span>`, 'error');
  } else {
    alert("🚨 系統發生致命錯誤！\n錯誤訊息：" + msg + "\n發生在第 " + line + " 行。");
  }
};

let currentUID = ""; 
let globalUserName = "未綁定會友"; 
// 【新增】用來儲存使用者的完整資料供報名使用
let currentUserData = null; 

// 🚨 如果您的 LIFF ID 有變動，請記得在此修改
const myLiffId = '2009444508-qaGGdlps';
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwa4MCwa6_Uky7EkbUcghr-_ikexNIbdYZY23U3oysE4Kv6jendZafVbyXB1_2Cpqo-/exec';

// 【快取設定】
const CACHE_PREFIX = 'church_data_';
const CACHE_TTL = 10 * 60 * 1000; // 10 分鐘快取

const categoryConfig = {
  '服事者課程': {概念: '服事', 顏色: '#dc3545'},
  '司會訓練': {概念: '服事', 顏色: '#dc3545'},
  '信徒造就課程': {概念: '造就', 顏色: '#28a745'},
  '聖經課程': {概念: '造就', 顏色: '#28a745'},
  '聯誼活動': {概念: '尋羊', 顏色: '#f39c12'},  
  '團契出遊': {概念: '尋羊', 顏色: '#f39c12'},
  '福音活動': {概念: '見證', 顏色: '#9b59b6'},
  '聖誕晚會': {概念: '見證', 顏色: '#9b59b6'}
};

window.triggerLineLogin = function() {
  const cleanUrl = window.location.origin + window.location.pathname;
  liff.login({ redirectUri: cleanUrl });
};

// ==========================================
// 【大升級 1】自動偵測網址並點亮導覽列圖示 (第二階段切割後生效)
// ==========================================
function setActiveNav() {
  const path = window.location.pathname;
  document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
  
  if (path.includes('events.html')) {
    const nav = document.getElementById('nav-events');
    if (nav) nav.classList.add('active');
  } else if (path.includes('finance.html')) {
    const nav = document.getElementById('nav-finance');
    if (nav) nav.classList.add('active');
  } else if (path.includes('prayer.html')) {
    const nav = document.getElementById('nav-prayer');
    if (nav) nav.classList.add('active');
  } else {
    const nav = document.getElementById('nav-profile');
    if (nav) nav.classList.add('active');
  }
}

// ==========================================
// 【大升級 2】防呆裝甲 (安全填值函數)
// ==========================================
function safeSetText(id, text) {
  const el = document.getElementById(id);
  if (el) el.innerText = text;
}
function safeSetHTML(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}
function safeSetVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

document.addEventListener("DOMContentLoaded", function() {
  setActiveNav(); // 網頁載入時自動亮燈
  
  const loadingEl = document.getElementById('loading');
  if (loadingEl) loadingEl.style.display = 'flex';
  
  if (!myLiffId) {
    Swal.fire('錯誤', '網頁沒有設定 LIFF ID！', 'error');
    if (loadingEl) loadingEl.style.display = 'none';
    return;
  }

  liff.init({ liffId: myLiffId })
    .then(() => {
      if (!liff.isLoggedIn()) {
        if (loadingEl) {
          loadingEl.innerHTML = `
            <div class="text-center px-4">
              <i class="fab fa-line fa-4x text-success mb-3"></i>
              <h4 class="fw-bold mb-3 text-dark">等待登入驗證</h4>
              <p class="text-muted mb-4" style="font-size:0.95rem;">為了確保會友資料安全，<br>請點擊下方按鈕授權 LINE 登入。</p>
              <button class="btn btn-success w-100 py-2 rounded-pill shadow-sm" onclick="triggerLineLogin();">
                <i class="fas fa-sign-in-alt"></i> 點此授權登入
              </button>
            </div>
          `;
        }
      } else {
        liff.getProfile().then(profile => {
          currentUID = profile.userId;         
          const lineName = profile.displayName;
          fetchUserData(currentUID, lineName);
        }).catch(err => {
          Swal.fire('錯誤', '無法取得 LINE 帳號資料<br>' + err.message, 'error');
          if (loadingEl) loadingEl.style.display = 'none';
        });
      }
    })
    .catch((err) => {
      Swal.fire('錯誤', 'LIFF 啟動失敗！請檢查 LIFF ID 設定。<br>' + err.message, 'error');
      if (loadingEl) loadingEl.style.display = 'none';
    });
});

// 【新增】清除個人快取的函數
function clearCache() {
  if (currentUID) {
    localStorage.removeItem(CACHE_PREFIX + currentUID);
    console.log("已清除本地快取資料，確保抓取最新狀態！");
  }
}

// 【重構】獲取資料邏輯：先查快取，沒有再 fetch
function fetchUserData(uid, lineName) {
  const cacheKey = CACHE_PREFIX + uid;
  const cachedDataStr = localStorage.getItem(cacheKey);
  const loadingEl = document.getElementById('loading');

  if (cachedDataStr) {
    try {
      const cacheObj = JSON.parse(cachedDataStr);
      const now = new Date().getTime();
      if (now - cacheObj.timestamp < CACHE_TTL) {
        console.log("⚡ 讀取本地快取資料 (0秒載入)");
        if (loadingEl) loadingEl.style.display = 'none';
        renderUI(cacheObj.data, lineName);
        return; 
      } else {
        console.log("⏳ 快取已過期，重新向伺服器請求資料");
      }
    } catch (e) {
      console.error("快取解析失敗", e);
    }
  }

  console.log("🌐 向 GAS 伺服器請求最新資料...");
  fetch(`${GAS_URL}?action=getUser&uid=${uid}`)
    .then(response => response.json())
    .then(response => {
      localStorage.setItem(cacheKey, JSON.stringify({
        timestamp: new Date().getTime(),
        data: response
      }));
      
      if (loadingEl) loadingEl.style.display = 'none'; 
      renderUI(response, lineName);
    })
    .catch(error => {
      Swal.fire('錯誤', '資料庫連線失敗！<br>' + error.message, 'error');
      if (loadingEl) loadingEl.style.display = 'none';
    });
}

// ==========================================
// 【大升級 3】核心渲染邏輯 (加入安全防護罩)
// ==========================================
function renderUI(response, lineName) {
  // 【新增】儲存全域資料，供報名表單自動帶入使用
  currentUserData = response;
  
  if(response.found) {
    globalUserName = response.name; 
    safeSetText("ui-userName", response.name + "，平安！");
    
    let tierName = response.tier === 'Tier 2' ? "Tier 2 驗證用戶" : "Tier 1 綁定用戶";
    let tierBadge = response.tier === 'Tier 2' ? "bg-warning text-dark" : "bg-primary text-white";
    
    const uiUserTier = document.getElementById("ui-userTier");
    if (uiUserTier) {
      uiUserTier.className = "badge mt-2 " + tierBadge;
      uiUserTier.innerHTML = '<i class="fas fa-medal"></i> ' + tierName + ' <i class="fas fa-question-circle ms-1"></i>';
    }

    // ====== 會友中心專屬 (首頁) ======
    safeSetText("info-phone", response.phone || "未填寫");
    safeSetText("info-birthday", response.birthday || "未填寫");
    safeSetText("info-service", response.service || "未設定");
    safeSetText("info-groups", response.groups || "未設定");
    safeSetVal("input-phone", response.phone);
    safeSetVal("input-birthday", response.birthday);
    safeSetText("info-event-count", `${response.eventCount} 場`);
    safeSetText("info-course-count", `${response.courseCount} 堂`);

    const historyContainer = document.getElementById("history-list");
    if (historyContainer) {
      historyContainer.innerHTML = "";
      let radarData = { '服事': 0, '造就': 0, '尋羊': 0, '見證': 0 };

      if (response.attendedHistory && response.attendedHistory.length > 0) {
          response.attendedHistory.forEach(ev => {
              let config = categoryConfig[ev.category] || {概念: '尋羊', 顏色: '#f39c12'};
              if (radarData[config.概念] !== undefined) radarData[config.概念] += 1;
              historyContainer.innerHTML += `
              <li class="list-group-item d-flex justify-content-between align-items-center px-0 py-3 border-bottom">
                <div>
                  <div class="fw-bold text-dark">${ev.name}</div>
                  <div class="text-muted mt-1" style="font-size: 0.8rem;"><i class="far fa-calendar-check"></i> 參與日期：${ev.eventDate}</div>
                </div>
                <span class="badge rounded-pill" style="background-color: ${config.顏色}; font-weight: normal;">${ev.category}</span>
              </li>`;
          });
          renderRadarChart(radarData);
      } else {
          historyContainer.innerHTML = '<li class="list-group-item text-center text-muted py-4">尚無出席紀錄，繼續加油！</li>';
          renderRadarChart(radarData); 
      }
    }

    const historyBtn = document.getElementById("btn-spiritual-history");
    if (historyBtn) {
      if (response.eventCount === 0 && response.courseCount === 0 && (!response.registeredEvents || response.registeredEvents.length === 0)) {
        historyBtn.innerHTML = '<i class="fas fa-calendar-plus"></i> 首次報名';
        historyBtn.className = 'btn btn-primary w-100 mt-3 shadow-sm rounded-pill';
        // 第一階段(未切割)保留單頁切換，第二階段會改為 href跳轉
        historyBtn.onclick = function() { switchPage('events'); }; 
        historyBtn.removeAttribute('data-bs-toggle');
        historyBtn.removeAttribute('data-bs-target');
      } else {
        historyBtn.innerHTML = '<i class="fas fa-book-open"></i> 展開我的學習歷程';
        historyBtn.className = 'btn btn-outline-primary w-100 mt-3 rounded-pill';
        historyBtn.onclick = null; 
        historyBtn.setAttribute('data-bs-toggle', 'modal');
        historyBtn.setAttribute('data-bs-target', '#historyModal');
      }
    }

    const serviceContainer = document.getElementById("checkbox-services");
    if (serviceContainer) {
      serviceContainer.innerHTML = "";
      const userServices = (response.service || "").split("、").map(s => s.trim());
      if (response.availableServices && response.availableServices.length > 0) {
        response.availableServices.forEach((serviceName, index) => {
          const isChecked = userServices.includes(serviceName) ? "checked" : "";
          serviceContainer.innerHTML += `<div class="col-6 form-check mb-2"><input class="form-check-input" type="checkbox" value="${serviceName}" id="chk-srv-${index}" ${isChecked}><label class="form-check-label text-muted" for="chk-srv-${index}" style="font-size: 0.9rem;">${serviceName}</label></div>`;
        });
      } else {
        serviceContainer.innerHTML = `<div class="col-12 text-muted" style="font-size: 0.8rem;">無可選擇的服事單位</div>`;
      }
    }

    const groupContainer = document.getElementById("checkbox-groups");
    if (groupContainer) {
      groupContainer.innerHTML = "";
      const userGroups = (response.groups || "").split("、").map(g => g.trim());
      if (response.availableGroups && response.availableGroups.length > 0) {
        response.availableGroups.forEach((groupName, index) => {
          const isChecked = userGroups.includes(groupName) ? "checked" : "";
          groupContainer.innerHTML += `<div class="col-6 form-check mb-2"><input class="form-check-input" type="checkbox" value="${groupName}" id="chk-grp-${index}" ${isChecked}><label class="form-check-label text-muted" for="chk-grp-${index}" style="font-size: 0.9rem;">${groupName}</label></div>`;
        });
      } else {
        groupContainer.innerHTML = `<div class="col-12 text-muted" style="font-size: 0.8rem;">目前無開放訂閱的頻道</div>`;
      }
    }

    const boundView = document.getElementById("bound-profile-view");
    if (boundView) boundView.style.display = "block";
    const unboundView = document.getElementById("unbound-view");
    if (unboundView) unboundView.style.display = "none";

  } else {
    // 【修改】未綁定時也記錄基本 Tier 0 資料，供報名表單安全帶入使用
    currentUserData = { found: false, name: lineName, phone: "", birthday: "", tier: "Tier 0", groups: "", service: "" };
    
    globalUserName = lineName;
    safeSetText("ui-userName", lineName + "，您好！");
    const uiUserTier = document.getElementById("ui-userTier");
    if (uiUserTier) {
      uiUserTier.className = "badge mt-2 bg-secondary text-white";
      uiUserTier.innerHTML = '<i class="fas fa-user"></i> Tier 0 一般用戶 <i class="fas fa-question-circle ms-1"></i>';
    }
    const unboundView = document.getElementById("unbound-view");
    if (unboundView) unboundView.style.display = "block";
    const boundView = document.getElementById("bound-profile-view");
    if (boundView) boundView.style.display = "none";
  }
  
  // ====== 活動報名專屬 (events.html) ======
  const regEventListContainer = document.getElementById("registered-event-list");
  if (regEventListContainer) {
    regEventListContainer.innerHTML = "";
    if (response.registeredEvents && response.registeredEvents.length > 0) {
      response.registeredEvents.forEach(ev => {
        let config = categoryConfig[ev.category] || {顏色: '#6c757d'};
        let cancelIcon = ev.canCancel ? `<i class="fas fa-times-circle fa-2x text-danger" style="cursor: pointer;" onclick="cancelRegistration('${ev.regId}', '${ev.name}')"></i>` : `<i class="fas fa-times-circle fa-2x text-secondary" style="opacity: 0.3;" title="報名已截止，請聯繫辦公室"></i>`;
        regEventListContainer.innerHTML += `
        <div class="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom">
          <div>
            <span class="badge rounded-pill mb-1" style="background-color: ${config.顏色}; font-size:0.7rem;">${ev.category}</span>
            <div class="fw-bold text-dark mb-1">${ev.name}</div>
            <div class="text-muted" style="font-size: 0.8rem;"><i class="far fa-calendar-alt"></i> ${ev.date}</div>
            <div class="text-secondary mt-1" style="font-size: 0.8rem;"><span class="badge bg-light text-dark border">${ev.regType}</span> 參與者: ${ev.participantName}</div>
          </div>
          <div class="d-flex flex-column align-items-center justify-content-center">
            <span class="text-success mb-2"><i class="fas fa-check-circle fa-2x"></i></span>${cancelIcon}
          </div>
        </div>`;
      });
      const regView = document.getElementById("registered-view");
      if(regView) regView.style.display = "block";
    } else {
      const regView = document.getElementById("registered-view");
      if(regView) regView.style.display = "none";
    }
  }

  const eventListContainer = document.getElementById("event-list");
  if (eventListContainer) {
    eventListContainer.innerHTML = "";
    if (response.activeEvents && response.activeEvents.length > 0) {
      response.activeEvents.forEach(ev => {
        let config = categoryConfig[ev.category] || {顏色: '#3498db'};
        let countdownHtml = '';
        if (ev.regEndDate) {
          let diff = ev.regEndDate - new Date().getTime();
          if (diff > 0) {
            let days = Math.ceil(diff / (1000 * 60 * 60 * 24));
            countdownHtml = days <= 1 ? `<div class="text-danger fw-bold mb-1" style="font-size: 0.8rem; animation: pulse 2s infinite;"><i class="fas fa-exclamation-circle"></i> 今日截止</div>` : `<div class="text-danger fw-bold mb-1" style="font-size: 0.8rem;"><i class="fas fa-hourglass-half"></i> 剩餘 ${days} 天</div>`;
          }
        }
        let spotsHtml = (ev.remainingSpots !== null && ev.remainingSpots !== undefined) ? `<span class="badge bg-danger ms-2 align-middle" style="font-size:0.75rem;"><i class="fas fa-fire"></i> 剩 ${ev.remainingSpots} 名</span>` : '';

        eventListContainer.innerHTML += `
        <div class="card p-3 shadow-sm border-0 mb-3" style="border-left: 5px solid ${config.顏色} !important;">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <span class="badge mb-2" style="background-color: ${config.顏色};">${ev.category}</span>
              <h5 class="fw-bold mb-1 text-dark">${ev.name} ${spotsHtml}</h5>
              <div class="text-muted" style="font-size: 0.85rem;"><i class="far fa-calendar-alt w-20px"></i> ${ev.date}</div>
            </div>
            <div class="text-end">
              ${countdownHtml}
              <button class="btn btn-sm rounded-pill px-4 text-white" style="background-color: ${config.顏色}; border:none;" onclick="openRegModal('${ev.id}', '${ev.name}', ${ev.allowProxy}, ${ev.requireExtraInfo})">報名</button>
              <div class="mt-2"><a href="#" onclick="shareToLine('${ev.name}', '${ev.id}')" class="share-line-btn"><i class="fab fa-line fa-lg"></i> 邀請朋友</a></div>
            </div>
          </div>
        </div>`;
      });
    } else {
      eventListContainer.innerHTML = '<div class="text-center text-muted my-4">目前沒有開放報名的活動或課程。</div>';
    }
  }

  // ====== 奉獻財務專屬 (finance.html) ======
  const financeUnlocked = document.getElementById('finance-unlocked');
  if (financeUnlocked) {
    safeSetText('dynamicYear', response.sysYear); 
    const locked = document.getElementById('finance-locked');
    if (locked) locked.style.display = (response.tier === 'Tier 2' && response.found) ? 'none' : 'block';
    financeUnlocked.style.display = (response.tier === 'Tier 2' && response.found) ? 'block' : 'none';
    if (response.tier === 'Tier 2' && response.found) {
      renderDonationChart();
    }
  }

  // 第一階段：因為還沒切割 HTML，需要依賴 switchPage 切換顯示區塊
  const urlParams = new URLSearchParams(window.location.search);
  const targetPage = urlParams.get('page') || "profile";
  switchPage(targetPage);
}

// 【第一階段保留】切換隱藏顯示邏輯 (第二階段會刪除)
function switchPage(pageId) {
  const pages = ['profile', 'finance', 'prayer', 'events'];
  pages.forEach(p => {
    const pageEl = document.getElementById('page-' + p);
    if (pageEl) pageEl.style.display = 'none';
    const navEl = document.getElementById('nav-' + p);
    if (navEl) navEl.classList.remove('active');
  });

  const targetPageEl = document.getElementById('page-' + pageId);
  if (targetPageEl) targetPageEl.style.display = 'block';
  const targetNavEl = document.getElementById('nav-' + pageId);
  if (targetNavEl) targetNavEl.classList.add('active');

  if (pageId === 'finance') {
    renderDonationChart();
  }
}

// ==========================================
// 圖表與互動功能
// ==========================================
function renderRadarChart(data) {
  const canvas = document.getElementById('radarChart');
  if (!canvas) return; // 防呆
  const ctx = canvas.getContext('2d');
  
  if (window.myRadarChart) window.myRadarChart.destroy();
  const shortLabels = ['服事課程', '信徒課程', '聯誼活動', '福音活動'];
  const fullTooltips = ['服事課程 (參與事奉)', '信徒課程 (靈命培育)', '聯誼活動 (建立關係)', '福音活動 (宣揚福音)'];
  const values = [data['服事'] || 0, data['造就'] || 0, data['尋羊'] || 0, data['見證'] || 0];

  window.myRadarChart = new Chart(ctx, {
    type: 'radar',
    data: { labels: shortLabels, datasets: [{ label: '參與次數', data: values, backgroundColor: 'rgba(52, 152, 219, 0.2)', borderColor: '#3498db', borderWidth: 2, pointBackgroundColor: ['#dc3545', '#28a745', '#f39c12', '#9b59b6'], pointBorderColor: '#fff', pointRadius: 6, pointHoverRadius: 8 }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { r: { startAngle: 0, min: 0, suggestedMax: 5, angleLines: { color: 'rgba(0, 0, 0, 0.15)' }, grid: { color: 'rgba(0, 0, 0, 0.1)' }, pointLabels: { font: { size: 14, family: '微軟正黑體', weight: 'bold' }, color: function(context) { return ['#dc3545', '#28a745', '#f39c12', '#9b59b6'][context.index]; } }, ticks: { display: false, stepSize: 1 } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { title: function(tooltipItems) { return fullTooltips[tooltipItems[0].dataIndex]; }, label: function(context) { return `已參與：${context.raw} 次`; } } } } }
  });
}

function shareToLine(eventName, eventId) {
  const myLiffUrl = `https://liff.line.me/${myLiffId}?page=events`;
  const text = `平安！教會即將舉辦【${eventName}】，誠摯邀請你一起來參加！\n點擊下方連結即可快速報名：\n${myLiffUrl}`;
  window.open(`https://line.me/R/msg/text/?${encodeURIComponent(text)}`, '_blank');
}

function submitBinding() {
  const name = document.getElementById('bind-name').value.trim(); const phone = document.getElementById('bind-phone').value.trim(); const birthday = document.getElementById('bind-birthday').value;
  if (!name || !phone || !birthday) { Swal.fire('提醒', '請完整填寫真實姓名、電話與生日喔！', 'warning'); return; }
  const btn = document.querySelector('#unbound-view .btn-warning'); btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 處理中...';
  fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'bindUser', uid: currentUID, lineName: globalUserName, realName: name, phone: phone, birthday: birthday }) })
  .then(res => res.json()).then(res => { if(res.success) { clearCache(); Swal.fire('綁定成功', res.message, 'success').then(() => window.location.reload()); } else { Swal.fire('綁定失敗', res.message, 'error'); btn.innerHTML = '<i class="fas fa-link"></i> 一鍵綁定 / 註冊'; } }).catch(error => { Swal.fire('連線錯誤', error.message, 'error'); btn.innerHTML = '<i class="fas fa-link"></i> 一鍵綁定 / 註冊'; });
}

function saveProfile() {
  const btn = document.querySelector('#editProfileModal .btn-primary');
  let newServicesArray = []; document.querySelectorAll('#checkbox-services input[type="checkbox"]:checked').forEach(chk => newServicesArray.push(chk.value));
  let newGroupsArray = []; document.querySelectorAll('#checkbox-groups input[type="checkbox"]:checked').forEach(chk => newGroupsArray.push(chk.value));
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 儲存中...';
  fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'saveProfile', uid: currentUID, phone: document.getElementById('input-phone').value, birthday: document.getElementById('input-birthday').value, groups: newGroupsArray.join('、'), service: newServicesArray.join('、') }) })
  .then(res => res.json()).then(res => { if(res.success) { clearCache(); Swal.fire('成功', '資料已成功更新！', 'success').then(() => window.location.reload()); } else { Swal.fire('錯誤', res.message, 'error'); btn.innerHTML = '儲存修改'; } }).catch(err => { Swal.fire('連線錯誤', err.message, 'error'); btn.innerHTML = '儲存修改'; });
}

function renderDonationChart() {
  const canvas = document.getElementById('donationChart'); if (!canvas) return; // 防呆
  const ctx = canvas.getContext('2d');
  const dataValues = [22100, 7800, 2600]; const totalAmount = dataValues.reduce((a, b) => a + b, 0); 
  if (window.myDonationChart) window.myDonationChart.destroy();
  window.myDonationChart = new Chart(ctx, { type: 'doughnut', data: { labels: ['月定獻金', '感恩獻金', '對外獻金-本宗'], datasets: [{ data: dataValues, backgroundColor: ['#3498db', '#2ecc71', '#f1c40f'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: function(context) { const label = context.label || ''; const value = context.raw; const percentage = Math.round((value / totalAmount) * 100); return `${label}: $ ${value.toLocaleString()} (${percentage}%)`; }}}} , cutout: '70%' } });
}

function applyFinanceAccess() { Swal.fire('已送出', '已發送申請！請等候辦公室同工審核開通。', 'success'); }
function toggleFamilyView() { Swal.fire({ title: document.getElementById('familySwitch').checked ? '已切換至【全戶視角】' : '已切換至【個人視角】', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 }); }

function submitPrayer() {
  const target = document.getElementById('prayer-target').value; const content = document.getElementById('prayer-content').value; const isPublic = document.querySelector('input[name="prayer-public"]:checked').value;
  if(!target || !content) { Swal.fire('提醒', '請填寫代禱對象與內容！', 'warning'); return; }
  const btn = document.querySelector('#page-prayer .btn-primary'); btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 傳送中...';
  
  fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'submitPrayer', uid: currentUID, userName: globalUserName, target: target, content: content, isPublic: isPublic }) })
  .then(res => res.json()).then(res => { if (res.success) { btn.innerHTML = '<i class="fas fa-paper-plane"></i> 送出代禱'; playPrayerAnimation(content); } else { Swal.fire('系統錯誤', res.message, 'error'); btn.innerHTML = '<i class="fas fa-paper-plane"></i> 重新送出'; } }).catch(err => { Swal.fire('連線錯誤', err.message, 'error'); btn.innerHTML = '<i class="fas fa-paper-plane"></i> 重新送出'; });
}

function playPrayerAnimation(inputText) {
  const overlay = document.getElementById('ritual-overlay'); const textElement = document.getElementById('ritual-prayer-text'); const doveIcon = document.getElementById('ritual-dove'); const scripture = document.getElementById('ritual-scripture');
  if (!overlay) return; // 防呆
  textElement.innerText = `"${inputText}"`; textElement.classList.remove('anim-text'); doveIcon.classList.remove('anim-dove'); scripture.classList.remove('scripture-show'); void textElement.offsetWidth; 
  overlay.style.display = 'flex'; setTimeout(() => { overlay.style.opacity = 1; }, 50);
  setTimeout(() => { textElement.classList.add('anim-text'); doveIcon.classList.add('anim-dove'); scripture.classList.add('scripture-show'); }, 100);
  setTimeout(() => { overlay.style.opacity = 0; setTimeout(() => { overlay.style.display = 'none'; document.getElementById('prayerForm').reset(); Swal.fire({ title: '奉耶穌基督的名祈禱，阿們！', text: '您的代禱事項已成功送出，將由牧者同工代禱。', icon: 'success', confirmButtonColor: '#0d6efd' }); }, 1500); }, 10500);
}

// ==========================================
// 【大升級 4】報名表單：自動帶入本人資料、清空與保險防呆
// ==========================================
function openRegModal(eventId, eventName, allowProxy, requireExtraInfo) {
  document.getElementById('regEventId').value = eventId; 
  document.getElementById('regEventName').innerText = eventName;
  
  const proxyOption = document.getElementById('opt-proxy');
  if (allowProxy) { 
    proxyOption.style.display = 'block'; 
  } else { 
    proxyOption.style.display = 'none'; 
    document.getElementById('regProxyType').value = 'self'; 
  }
  
  document.getElementById('extraInfoSection').style.display = requireExtraInfo ? 'block' : 'none';
  
  // 動態顯示「出生年月日」的必填紅色星號 (如果有保險)
  const reqBday = document.getElementById('req-bday');
  if(reqBday) reqBday.style.display = requireExtraInfo ? 'inline' : 'none';
  
  toggleProxyFields(); // 觸發自動帶入本人資料
  document.getElementById('regAgree').checked = false;
  new bootstrap.Modal(document.getElementById('regModal')).show();
}

function toggleProxyFields() { 
  const isProxy = document.getElementById('regProxyType').value === 'proxy';
  
  if (!isProxy && currentUserData) {
    // 【本人參加】：自動帶入全域儲存的資料
    document.getElementById('regParticipantName').value = currentUserData.name !== "未綁定會友" ? currentUserData.name : globalUserName;
    document.getElementById('regParticipantPhone').value = currentUserData.phone || "";
    document.getElementById('regParticipantBirthday').value = currentUserData.birthday || "";
  } else {
    // 【代為報名】：清空所有欄位
    document.getElementById('regParticipantName').value = "";
    document.getElementById('regParticipantPhone').value = "";
    document.getElementById('regParticipantBirthday').value = "";
  }
}

// ==========================================
// 【大升級 5】送出報名：涵蓋個資校正與 Tier 0 一鍵升級漏斗
// ==========================================
function submitRegistration() {
  if (!document.getElementById('regAgree').checked) { Swal.fire('提醒', '請先勾選同意收集資料聲明喔！', 'warning'); return; }
  
  const isProxy = (document.getElementById('regProxyType').value === 'proxy'); 
  let pName = document.getElementById('regParticipantName').value.trim();
  let pPhone = document.getElementById('regParticipantPhone').value.trim();
  let pBday = document.getElementById('regParticipantBirthday').value;

  if (!pName) { Swal.fire('提醒', '請填寫「參與者真實姓名」！', 'warning'); return; } 
  if (!pPhone) { Swal.fire('提醒', '請填寫「聯絡電話」！', 'warning'); return; } 

  let extraObj = {};
  if (pBday) extraObj.生日 = pBday; // 只要有填生日就寫入 JSON 備註

  const isExtraRequired = document.getElementById('extraInfoSection').style.display !== 'none';
  if (isExtraRequired) { 
    const idNumber = document.getElementById('regIdNumber').value.trim();
    if (!idNumber || !pBday) { Swal.fire('提醒', '辦理平安險需填寫「身分證與生日」！', 'warning'); return; } 
    extraObj.身分證 = idNumber;
  }
  
  if (document.getElementById('regMemo').value) extraObj.備註 = document.getElementById('regMemo').value;
  
  const btn = document.querySelector('#regModal .btn-primary'); 
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 處理中...';
  
  fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'submitRegistration', eventId: document.getElementById('regEventId').value, uid: currentUID, isProxy: isProxy, participantName: pName, participantPhone: pPhone, extraInfoStr: JSON.stringify(extraObj) }) })
  .then(res => res.json()).then(res => { 
    if (res.success) { 
      clearCache(); 
      bootstrap.Modal.getInstance(document.getElementById('regModal')).hide(); 
      document.getElementById('regForm').reset(); 

      // === 報名成功後的行銷漏斗與個資校正 ===
      if (!isProxy) {
        if (currentUserData.found) { 
          // 【Tier 1】檢查資料是否異動
          if (pPhone !== currentUserData.phone || pBday !== currentUserData.birthday) {
            Swal.fire({
              title: '🎉 報名成功！',
              html: '系統發現您的<b>電話或生日</b>與原紀錄不同。<br>是否要一併校正您的個人基本資料？',
              icon: 'success', showCancelButton: true, confirmButtonText: '一併校正', cancelButtonText: '暫不更新', confirmButtonColor: '#28a745'
            }).then((result) => {
              if (result.isConfirmed) {
                // 背景呼叫更新 API
                fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'saveProfile', uid: currentUID, phone: pPhone, birthday: pBday, groups: currentUserData.groups, service: currentUserData.service }) })
                .then(()=> { clearCache(); window.location.reload(); });
              } else { window.location.reload(); }
            });
            return; // 提早結束
          }
        } else {
          // 【Tier 0】引導無縫註冊
          Swal.fire({
            title: '🎉 報名成功！',
            html: '您目前尚未綁定會友資料。<br>是否使用剛剛填寫的資料，<b>一鍵免費升級為「綁定用戶」</b>？<br>未來報名不需重填，還可解鎖學習護照！',
            icon: 'success', showCancelButton: true, confirmButtonText: '一鍵升級', cancelButtonText: '下次再說', confirmButtonColor: '#f39c12'
          }).then((result) => {
            if (result.isConfirmed) {
              // 背景呼叫綁定 API
              fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'bindUser', uid: currentUID, lineName: globalUserName, realName: pName, phone: pPhone, birthday: pBday }) })
              .then(()=> { clearCache(); window.location.reload(); });
            } else { window.location.reload(); }
          });
          return; // 提早結束
        }
      }

      Swal.fire('報名成功', res.message, 'success').then(() => { window.location.reload(); }); 
    } else { 
      Swal.fire('報名失敗', res.message, 'error'); 
      btn.innerHTML = '<i class="fas fa-paper-plane"></i> 確定送出報名'; 
    } 
  }).catch(err => { Swal.fire('連線錯誤', err.message, 'error'); btn.innerHTML = '<i class="fas fa-paper-plane"></i> 確定送出報名'; });
}

function cancelRegistration(regId, eventName) {
  Swal.fire({ title: '確定取消報名嗎？', html: `活動：<b>${eventName}</b><br>取消後將釋出您的名額。`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc3545', cancelButtonColor: '#6c757d', confirmButtonText: '是的，我要取消', cancelButtonText: '保留名額' }).then((result) => {
    if (result.isConfirmed) {
      Swal.fire({ title: '處理中', text: '正在取消報名...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } });
      fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'cancelRegistrationUser', regId: regId, uid: currentUID }) }).then(res => res.json()).then(res => { if (res.success) { clearCache(); Swal.fire('已取消', res.message, 'success').then(() => { window.location.reload(); }); } else { Swal.fire('錯誤', res.message, 'error'); } }).catch(err => { Swal.fire('連線錯誤', err.message, 'error'); });
    }
  });
}

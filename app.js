window.onerror = function(msg, url, line) {
  if (typeof Swal !== 'undefined') {
    Swal.fire('系統錯誤', `請截圖回報。<br><span style="font-size:0.8rem;color:red;">${msg}<br>行數：${line}</span>`, 'error');
  } else {
    alert("🚨 系統發生致命錯誤！\n錯誤訊息：" + msg + "\n發生在第 " + line + " 行。");
  }
};

let currentUID = ""; 
let globalUserName = "未綁定會友"; 
let currentUserData = null; 
let globalActiveEvents = []; 
let dynamicCategoryConfig = {};
let globalIsAdmin = false;
let globalAdminLevel = "";

window.triggerLineLogin = function() {
  const cleanUrl = window.location.origin + window.location.pathname;
  liff.login({ redirectUri: cleanUrl });
};

// 【方案 B 新增】強制檢查是否為官方帳號好友
async function requireLineFriend() {
  try {
    const friend = await liff.getFriendship();
    if (!friend.friendFlag) {
      Swal.fire({
        title: '🛑 無法接收通知',
        html: `您尚未加入「霧峰教會」官方帳號為好友，或已將我們封鎖。<br>為確保您能收到牧者回覆與活動通知，請先加入好友！<br><br><a href="https://line.me/R/ti/p/@bhpct" target="_blank" class="btn btn-success rounded-pill fw-bold mt-2"><i class="fab fa-line fa-lg"></i> 點此加為好友</a>`,
        icon: 'warning',
        confirmButtonText: '我已加入，繼續操作',
        confirmButtonColor: '#8e44ad'
      });
      return false;
    }
    return true;
  } catch (err) {
    console.error('Liff Friendship Check Failed', err);
    return true; // 如果 API 失敗，預設放行以免卡死
  }
}

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
  } else if (path.includes('passport.html')) {
    const nav = document.getElementById('nav-passport');
    if (nav) nav.classList.add('active');
  } else {
    const nav = document.getElementById('nav-profile');
    if (nav) nav.classList.add('active');
  }
}

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

// ==========================================
// 【防呆啟動引擎】確保 config.js 載入後才啟動
// ==========================================
function initApp() {
  setActiveNav(); 
  const loadingEl = document.getElementById('loading');
  if (loadingEl) loadingEl.style.display = 'flex';
  
  // 檢查 CONFIG 是否存在 (防呆：萬一 config.js 比較慢載入)
  if (typeof window.CONFIG === 'undefined') {
      console.warn("等待 config.js 載入中...");
      setTimeout(initApp, 100); // 延遲 0.1 秒再試一次
      return;
  }

  // 讀取 config.js 裡的變數
  const liffId = window.CONFIG.LIFF_ID;
  
  if (!liffId) {
    Swal.fire('錯誤', '網頁沒有設定 LIFF ID！請檢查 config.js', 'error');
    if (loadingEl) loadingEl.style.display = 'none';
    return;
  }

  liff.init({ liffId: liffId })
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
}

// 判斷網頁是否已經載入完畢，錯過事件就直接強制啟動！
if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp(); 
}
// ==========================================

function clearCache() {
  if (currentUID) {
    localStorage.removeItem(window.CACHE_PREFIX + currentUID);
    console.log("已清除本地快取資料，確保抓取最新狀態！");
  }
}

// 【回合 A 防呆】一鍵清除快取並重整，確保幹事權限生效
function forceRefresh() {
  clearCache();
  window.location.reload();
}

function fetchUserData(uid, lineName) {
  const cacheKey = window.CACHE_PREFIX + uid;
  const cachedDataStr = localStorage.getItem(cacheKey);
  const loadingEl = document.getElementById('loading');
  const gasUrl = window.CONFIG.GAS_URL; 

  if (cachedDataStr) {
    try {
      const cacheObj = JSON.parse(cachedDataStr);
      const now = new Date().getTime();
      if (now - cacheObj.timestamp < window.CONFIG.CACHE_TTL) {
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
  fetch(`${gasUrl}?action=getUser&uid=${uid}`)
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

function renderUI(response, lineName) {
  currentUserData = response;
  globalActiveEvents = response.activeEvents || []; 
  dynamicCategoryConfig = response.categoryConfig || {};
  
  globalIsAdmin = response.isAdmin || false;
  globalAdminLevel = response.adminLevel || "";

  // 【第 6 點優化】讓前台按鈕與後台對齊：左上角是「管理後台」(若為管理員)，右上角是「白色的重整圈圈」
  const headerEl = document.querySelector('.church-header');
  if (headerEl) {
      const existingAdminBtn = document.getElementById('btn-to-admin-container');
      const existingRefreshBtn = document.getElementById('btn-force-refresh');
      if (existingAdminBtn) existingAdminBtn.remove();
      if (existingRefreshBtn) existingRefreshBtn.remove();

      headerEl.style.position = 'relative'; 

      const refreshBtnHtml = `
          <button id="btn-force-refresh" class="btn btn-sm btn-outline-light rounded-circle shadow-sm border-white" onclick="forceRefresh()" style="position: absolute; top: 15px; right: 15px;" title="重新抓取最新資料">
              <i class="fas fa-sync-alt text-white"></i>
          </button>
      `;
      headerEl.innerHTML += refreshBtnHtml;

      if (globalIsAdmin) {
          const adminBtnHtml = `
              <div id="btn-to-admin-container" style="position: absolute; top: 15px; left: 15px;">
                  <button id="btn-to-admin" class="btn btn-sm btn-light rounded-pill shadow-sm" onclick="window.location.href='admin.html'" style="font-size: 0.8rem; font-weight: bold; color: #8e44ad;">
                      <i class="fas fa-cog"></i> 管理後台
                  </button>
              </div>
          `;
          headerEl.innerHTML += adminBtnHtml;
      }
  }
  
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
      let radarData = { '服事': 1, '造就': 1, '尋羊': 1, '見證': 1 };

      if (response.attendedHistory && response.attendedHistory.length > 0) {
          response.attendedHistory.forEach(ev => {
              let config = dynamicCategoryConfig[ev.category] || {概念: '尋羊', 顏色: '#f39c12'};
              if (radarData[config.概念] !== undefined) radarData[config.概念] += 1;
              
              let fbBtnHtml = "";
              if (ev.feedbackStatus === "未填寫" && ev.regId && ev.eventId) {
                  fbBtnHtml = `<div class="mt-2 text-end"><button class="btn btn-sm btn-outline-warning rounded-pill fw-bold" onclick="openFeedbackModal('${ev.regId}', '${ev.eventId}', '${ev.name}')"><i class="fas fa-star"></i> 填寫回饋</button></div>`;
              } else if (ev.feedbackStatus === "已填寫") {
                  fbBtnHtml = `<div class="mt-2 text-end text-success" style="font-size:0.8rem;"><i class="fas fa-check-circle"></i> 已完成回饋</div>`;
              }

              historyContainer.innerHTML += `
              <li class="list-group-item px-0 py-3 border-bottom">
                <div class="d-flex justify-content-between align-items-start">
                  <div>
                    <div class="fw-bold text-dark">${ev.name}</div>
                    <div class="text-muted mt-1" style="font-size: 0.8rem;"><i class="far fa-calendar-check"></i> 參與日期：${ev.eventDate}</div>
                  </div>
                  <span class="badge rounded-pill" style="background-color: ${config.顏色}; font-weight: normal;">${ev.category}</span>
                </div>
                ${fbBtnHtml}
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
        historyBtn.onclick = function() { window.location.href = 'events.html'; }; 
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
  
  const regEventListContainer = document.getElementById("registered-event-list");
  if (regEventListContainer) {
    regEventListContainer.innerHTML = "";
    if (response.registeredEvents && response.registeredEvents.length > 0) {
      response.registeredEvents.forEach(ev => {
        let config = dynamicCategoryConfig[ev.category] || {顏色: '#6c757d'};
        
        let actionAreaHtml = '';

        if (ev.timingStatus === "進行中") {
            actionAreaHtml = `<button class="btn btn-success btn-sm rounded-pill shadow-sm fw-bold px-3 py-2" onclick="checkInEvent('${ev.regId}', '${ev.name}')"><i class="fas fa-map-marker-alt"></i> 點我簽到</button>`;
        } else {
            let cancelIcon = ev.canCancel 
                ? `<i class="fas fa-times-circle fa-2x text-danger" style="cursor: pointer;" onclick="cancelRegistration('${ev.regId}', '${ev.name}')" title="取消報名"></i>` 
                : `<i class="fas fa-times-circle fa-2x text-secondary" style="opacity: 0.4;" title="已過取消期限，請洽辦公室"></i>`;
            
            let statusIcon = '';
            if (ev.hasFee && ev.payStatus !== '已繳費') {
                statusIcon = `<div class="text-center mb-2" onclick="Swal.fire('繳費提醒', '本活動需收取 ${ev.feeAmount} 元。<br>請盡速繳交以完成報名手續。', 'info')"><i class="fas fa-check-circle fa-2x text-secondary" style="cursor:pointer;" title="尚未繳費"></i><div style="font-size:0.7rem; color:#6c757d;">待繳費</div></div>`;
            } else {
                let txt = ev.hasFee ? "已繳費" : "報名成功";
                statusIcon = `<div class="text-center mb-2"><i class="fas fa-check-circle fa-2x text-success"></i><div style="font-size:0.7rem; color:#28a745;">${txt}</div></div>`;
            }
            actionAreaHtml = `${statusIcon}${cancelIcon}`;
        }

        regEventListContainer.innerHTML += `
        <div class="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom">
          <div>
            <span class="badge rounded-pill mb-1" style="background-color: ${config.顏色}; font-size:0.7rem;">${ev.category}</span>
            <div class="fw-bold text-dark mb-1">${ev.name}</div>
            <div class="text-muted" style="font-size: 0.8rem;"><i class="far fa-calendar-alt"></i> ${ev.date}</div>
            <div class="text-secondary mt-1" style="font-size: 0.8rem;"><span class="badge bg-light text-dark border">${ev.regType}</span> 參與者: ${ev.participantName}</div>
          </div>
          <div class="d-flex flex-column align-items-center justify-content-center">
            ${actionAreaHtml}
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
        let config = dynamicCategoryConfig[ev.category] || {顏色: '#3498db'};
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
            
            <div onclick="openEventDetail('${ev.id}')" style="cursor:pointer; flex-grow: 1; min-width: 0;">
              <span class="badge mb-2" style="background-color: ${config.顏色};">${ev.category}</span>
              <h5 class="fw-bold mb-1 text-primary text-decoration-underline" style="color:${config.顏色} !important; word-break: break-word; white-space: normal;">${ev.name} ${spotsHtml}</h5>
              <div class="text-muted" style="font-size: 0.85rem;"><i class="far fa-calendar-alt w-20px"></i> ${ev.date}</div>
            </div>
            
            <div class="text-end ms-3 flex-shrink-0" style="min-width: 90px;">
              ${countdownHtml}
              <button class="btn btn-sm rounded-pill text-white w-100 shadow-sm" style="background-color: ${config.顏色}; border:none; padding-top:0.4rem; padding-bottom:0.4rem;" onclick="openRegModal('${ev.id}')">報名</button>
              <div class="mt-2 text-center">
                <a href="#" onclick="shareToLine('${ev.name}', '${ev.id}')" class="share-line-btn" style="font-size: 0.8rem; display:inline-block;"><i class="fab fa-line fa-lg"></i> 邀請朋友</a>
              </div>
            </div>
            
          </div>
        </div>`;
      });
    } else {
      eventListContainer.innerHTML = '<div class="text-center text-muted my-4">目前沒有開放報名的活動或課程。</div>';
    }
  }

  // ==========================================
  // 【重要更新】財務分頁：這裡加入了水線渲染引擎的呼叫
  // ==========================================
  const financeUnlocked = document.getElementById('finance-unlocked');
  if (financeUnlocked) {
    safeSetText('dynamicYear', response.sysYear); 
    const locked = document.getElementById('finance-locked');
    if (locked) locked.style.display = (response.tier === 'Tier 2' && response.found) ? 'none' : 'block';
    financeUnlocked.style.display = (response.tier === 'Tier 2' && response.found) ? 'block' : 'none';
    
    const familySwitch = document.getElementById('familySwitch');
    if (familySwitch) {
       if (familySwitch.checked && !response.familyView) {
           familySwitch.checked = false;
       }
    }
    
    if (response.tier === 'Tier 2' && response.found) {
      renderRealDonationChart(response.personalFinance, (familySwitch && familySwitch.checked));
      
      // 【關鍵新增】只要是驗證用戶且資料存在，就立刻渲染最上方的教會整體進度水線！
      if (response.churchFinance) {
          renderChurchHealth(response.churchFinance, response.sysYear);
      }
    }
  }

  const urlParams = new URLSearchParams(window.location.search);
  let targetPage = urlParams.get('page');
  
  if (!targetPage) {
    const path = window.location.pathname;
    if (path.includes('events.html')) targetPage = 'events';
    else if (path.includes('finance.html')) targetPage = 'finance';
    else if (path.includes('prayer.html')) targetPage = 'prayer';
    else if (path.includes('passport.html')) targetPage = 'passport'; // 加入 passport 判斷
    else targetPage = 'profile'; 
  }
  switchPage(targetPage);

  const targetEventId = urlParams.get('eventId');
  if (targetEventId && targetPage === 'events') {
    setTimeout(() => {
      openEventDetail(targetEventId);
    }, 300);
  }
}

// ========== 👇 完整替換 app.js 裡的 renderRealDonationChart 👇 ==========
// 接收真實財務數據並根據視角開關渲染圖表與列表
function renderRealDonationChart(financeData, isFamilyView = false) {
  if (!financeData) return;
  
  // 1. 計算「個人」與「全戶」的總金額
  let personalTotal = 0;
  let familyTotal = 0;
  
  financeData.records.forEach(r => {
      if (r.isMine) personalTotal += r.amount;
      familyTotal += r.amount;
  });

  // 2. 更新上方卡片的金額與排版 (並排對比)
  document.getElementById('finance-personal-total').innerText = '$ ' + personalTotal.toLocaleString();
  document.getElementById('finance-family-total').innerText = '$ ' + familyTotal.toLocaleString();
  
  const pBox = document.getElementById('personal-total-box');
  const fBox = document.getElementById('family-total-box');
  if (isFamilyView) {
      pBox.className = 'col-6'; 
      fBox.style.display = 'block'; 
  } else {
      pBox.className = 'col-12';
      fBox.style.display = 'none';
  }

  // 3. 根據視角過濾紀錄，並計算分類佔比
  let filteredRecords = isFamilyView ? financeData.records : financeData.records.filter(r => r.isMine);
  let calcCat = {};
  let calcTotal = 0; 

  filteredRecords.forEach(r => {
      calcTotal += r.amount;
      if (!calcCat[r.itemName]) calcCat[r.itemName] = 0;
      calcCat[r.itemName] += r.amount;
  });

  // 4. 【重點優化】依照金額大小排序科目，並套用友善色彩 (金額最大給綠色)
  const colorPalette = ['#2ecc71', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#34495e', '#95a5a6', '#e74c3c'];
  let colorMap = {};
  let sortedCats = Object.keys(calcCat).sort((a, b) => calcCat[b] - calcCat[a]); // 金額由大到小排序
  
  sortedCats.forEach((cat, idx) => {
      colorMap[cat] = colorPalette[idx % colorPalette.length];
  });

  // 5. 繪製圓餅圖 (套用綁定顏色)
  const canvas = document.getElementById('donationChart'); 
  if (canvas) { 
      const ctx = canvas.getContext('2d');
      const labels = sortedCats; // 使用排序好的科目
      const dataValues = labels.map(label => calcCat[label]);
      const chartColors = labels.map(label => colorMap[label]); 
      const totalAmount = calcTotal || 1; 
      
      if (window.myDonationChart) window.myDonationChart.destroy();
      
      if (labels.length === 0) {
          window.myDonationChart = new Chart(ctx, { type: 'doughnut', data: { labels: ['尚無資料'], datasets: [{ data: [1], backgroundColor: ['#e9ecef'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false }}, cutout: '70%' } });
      } else {
          window.myDonationChart = new Chart(ctx, { 
              type: 'doughnut', 
              data: { labels: labels, datasets: [{ data: dataValues, backgroundColor: chartColors, borderWidth: 0 }] }, 
              options: { 
                  responsive: true, maintainAspectRatio: false, 
                  plugins: { 
                      legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } }, 
                      tooltip: { callbacks: { label: function(context) { const label = context.label || ''; const value = context.raw; const percentage = Math.round((value / totalAmount) * 100); return `${label}: $ ${value.toLocaleString()} (${percentage}%)`; }}}} , 
                  cutout: '70%' 
              } 
          });
      }
  }

  // 6. 渲染逐筆明細 (套用淡化區分邏輯與綁定顏色)
  const listContainer = document.getElementById('donation-list');
  if (listContainer) {
      listContainer.innerHTML = '';
      if (filteredRecords && filteredRecords.length > 0) {
          filteredRecords.forEach(r => {
             let isMe = r.isMine;
             let catColor = colorMap[r.itemName] || '#6c757d'; 
             
             let titleStyle = isMe ? "fw-bold text-dark" : "text-secondary";
             let nameStyle = isMe ? "text-dark fw-bold" : "text-muted";
             let bgStyle = isMe ? "" : "background-color: #fcfcfc;";
             let dotOpacity = isMe ? "1" : "0.5";
             
             let badgeStyle = isMe 
                 ? `background-color: ${catColor}; color: white; border: 1px solid ${catColor};` 
                 : `background-color: transparent; color: ${catColor}; border: 1px dashed ${catColor}; opacity: 0.8;`;

             listContainer.innerHTML += `
                <li class="list-group-item d-flex justify-content-between align-items-center p-3 border-0 border-bottom" style="${bgStyle}">
                  <div>
                    <h6 class="mb-1 ${titleStyle}" style="${isMe ? '' : 'font-weight: normal !important;'};">
                       <span style="display:inline-block; width:10px; height:10px; background-color:${catColor}; border-radius:50%; margin-right:5px; opacity:${dotOpacity};"></span>
                       ${r.itemName}
                    </h6>
                    <small class="text-muted"><i class="far fa-calendar-alt"></i> ${r.date} | <span class="${nameStyle}">${r.name}</span></small>
                  </div>
                  <span class="badge rounded-pill px-3 py-2" style="font-size:1rem; ${badgeStyle}">$ ${r.amount.toLocaleString()}</span>
                </li>
             `; 
          });
      } else {
          listContainer.innerHTML = `<li class="list-group-item p-4 text-center text-muted border-0">此視角下尚無奉獻紀錄</li>`;
      }
  }
}
// ========== 👆 替換到此結束 👆 ==========

function switchPage(pageId) {
  const pages = ['profile', 'finance', 'prayer', 'events', 'passport']; // 加入 passport
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

  if (pageId === 'finance' && currentUserData && currentUserData.tier === 'Tier 2') {
    const familySwitch = document.getElementById('familySwitch');
    renderRealDonationChart(currentUserData.personalFinance, (familySwitch && familySwitch.checked));
  }
}

function renderRadarChart(data) {
  const canvas = document.getElementById('radarChart');
  if (!canvas) return; 
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
  const myLiffUrl = `https://liff.line.me/${window.CONFIG.LIFF_ID}/events.html?page=events&eventId=${eventId}`;
  const text = `平安！教會即將舉辦【${eventName}】，誠摯邀請你一起來參加！\n點擊下方連結即可快速報名：\n${myLiffUrl}`;
  window.open(`https://line.me/R/msg/text/?${encodeURIComponent(text)}`, '_blank');
}

// 【方案 B】在綁定時檢查是否有加官方帳號為好友
async function submitBinding() {
  const name = document.getElementById('bind-name').value.trim(); const phone = document.getElementById('bind-phone').value.trim(); const birthday = document.getElementById('bind-birthday').value;
  if (!name || !phone || !birthday) { Swal.fire('提醒', '請完整填寫真實姓名、電話與生日喔！', 'warning'); return; }
  
  const isFriend = await requireLineFriend();
  if (!isFriend) return;

  const btn = document.querySelector('#unbound-view .btn-warning'); btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 處理中...';
  const gasUrl = window.CONFIG.GAS_URL;
  fetch(gasUrl, { method: 'POST', body: JSON.stringify({ action: 'bindUser', uid: currentUID, lineName: globalUserName, realName: name, phone: phone, birthday: birthday }) })
  .then(res => res.json()).then(res => { if(res.success) { clearCache(); Swal.fire('綁定成功', res.message, 'success').then(() => window.location.reload()); } else { Swal.fire('綁定失敗', res.message, 'error'); btn.innerHTML = '<i class="fas fa-link"></i> 一鍵綁定 / 註冊'; } }).catch(error => { Swal.fire('連線錯誤', error.message, 'error'); btn.innerHTML = '<i class="fas fa-link"></i> 一鍵綁定 / 註冊'; });
}

function saveProfile() {
  const btn = document.querySelector('#editProfileModal .btn-primary');
  let newServicesArray = []; document.querySelectorAll('#checkbox-services input[type="checkbox"]:checked').forEach(chk => newServicesArray.push(chk.value));
  let newGroupsArray = []; document.querySelectorAll('#checkbox-groups input[type="checkbox"]:checked').forEach(chk => newGroupsArray.push(chk.value));
  
  const editModalEl = document.getElementById('editProfileModal');
  const editModalInstance = bootstrap.Modal.getInstance(editModalEl);
  if (editModalInstance) editModalInstance.hide();

  Swal.fire({ title: '儲存中', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } });
  const gasUrl = window.CONFIG.GAS_URL;
  fetch(gasUrl, { method: 'POST', body: JSON.stringify({ action: 'saveProfile', uid: currentUID, phone: document.getElementById('input-phone').value, birthday: document.getElementById('input-birthday').value, groups: newGroupsArray.join('、'), service: newServicesArray.join('、') }) })
  .then(res => res.json()).then(res => { 
    if(res.success) { 
      clearCache(); 
      Swal.fire('成功', '資料已成功更新！', 'success').then(() => window.location.reload()); 
    } else { 
      Swal.fire('錯誤', res.message, 'error').then(() => {
        if (editModalInstance) editModalInstance.show();
        btn.innerHTML = '儲存修改'; 
      });
    } 
  }).catch(err => { 
    Swal.fire('連線錯誤', err.message, 'error').then(() => {
      if (editModalInstance) editModalInstance.show();
      btn.innerHTML = '儲存修改'; 
    });
  });
}

function applyFinanceAccess() { 
  Swal.fire({
    title: '申請開通財務權限',
    html: '為了保護會友隱私，請本人攜帶手機至<b>教會辦公室</b>，由同工為您進行身份核對與權限開通。',
    icon: 'info',
    showCancelButton: true,
    confirmButtonText: '送出申請',
    cancelButtonText: '稍後再說',
    confirmButtonColor: '#28a745'
  }).then((result) => {
    if (result.isConfirmed) {
      Swal.fire({ title: '處理中', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } });
      const gasUrl = window.CONFIG.GAS_URL;
      fetch(gasUrl, { method: 'POST', body: JSON.stringify({ action: 'applyFinanceAccess', uid: currentUID }) })
      .then(res => res.json()).then(res => {
        if(res.success) { clearCache(); Swal.fire('已送出申請', '辦公室已收到您的申請，請盡速前往辦理。', 'success').then(()=>window.location.reload()); }
        else Swal.fire('錯誤', res.message, 'error');
      }).catch(err => Swal.fire('連線錯誤', err.message, 'error'));
    }
  });
}

// 攔截沒有權限的切換操作，若有權限則瞬間在前端切換過濾資料
function toggleFamilyView() { 
  const familySwitch = document.getElementById('familySwitch');
  
  if (currentUserData && !currentUserData.familyView) {
      Swal.fire('權限不足', '您目前僅能查詢個人明細。<br>若您是戶長需要檢視全戶奉獻，請向辦公室申請開通權限！', 'warning');
      familySwitch.checked = false; // 強制彈回
      return;
  }
  
  let isFamily = familySwitch.checked;
  Swal.fire({ 
      title: isFamily ? '已切換至【全戶視角】' : '已切換至【個人視角】', 
      icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 
  });
  
  renderRealDonationChart(currentUserData.personalFinance, isFamily);
}

async function submitPrayer() {
  const target = document.getElementById('prayer-target').value; const content = document.getElementById('prayer-content').value; const isPublic = document.querySelector('input[name="prayer-public"]:checked').value;
  if(!target || !content) { Swal.fire('提醒', '請填寫代禱對象與內容！', 'warning'); return; }
  
  const isFriend = await requireLineFriend();
  if (!isFriend) return;

  const btn = document.querySelector('#page-prayer .btn-primary'); btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 傳送中...';
  const gasUrl = window.CONFIG.GAS_URL;
  fetch(gasUrl, { method: 'POST', body: JSON.stringify({ action: 'submitPrayer', uid: currentUID, userName: globalUserName, target: target, content: content, isPublic: isPublic }) })
  .then(res => res.json()).then(res => { if (res.success) { btn.innerHTML = '<i class="fas fa-paper-plane"></i> 送出代禱'; playPrayerAnimation(content); } else { Swal.fire('系統錯誤', res.message, 'error'); btn.innerHTML = '<i class="fas fa-paper-plane"></i> 重新送出'; } }).catch(err => { Swal.fire('連線錯誤', err.message, 'error'); btn.innerHTML = '<i class="fas fa-paper-plane"></i> 重新送出'; });
}

function playPrayerAnimation(inputText) {
  const overlay = document.getElementById('ritual-overlay'); const textElement = document.getElementById('ritual-prayer-text'); const doveIcon = document.getElementById('ritual-dove'); const scripture = document.getElementById('ritual-scripture');
  if (!overlay) return; 
  textElement.innerText = `"${inputText}"`; textElement.classList.remove('anim-text'); doveIcon.classList.remove('anim-dove'); scripture.classList.remove('scripture-show'); void textElement.offsetWidth; 
  overlay.style.display = 'flex'; setTimeout(() => { overlay.style.opacity = 1; }, 50);
  setTimeout(() => { textElement.classList.add('anim-text'); doveIcon.classList.add('anim-dove'); scripture.classList.add('scripture-show'); }, 100);
  setTimeout(() => { overlay.style.opacity = 0; setTimeout(() => { overlay.style.display = 'none'; document.getElementById('prayerForm').reset(); Swal.fire({ title: '奉耶穌基督的名祈禱，阿們！', text: '您的代禱事項已成功送出，將由牧者同工代禱。', icon: 'success', confirmButtonColor: '#0d6efd' }); }, 1500); }, 10500);
}

function openEventDetail(eventId) {
  const evt = globalActiveEvents.find(e => e.id === eventId);
  if (!evt) return;

  document.getElementById('detailEventName').innerText = evt.name;
  
  const posterImg = document.getElementById('detailPoster');
  if (evt.posterUrl && evt.posterUrl.trim() !== '') {
      posterImg.src = evt.posterUrl;
      posterImg.style.display = 'block';
  } else {
      posterImg.style.display = 'none';
      posterImg.src = '';
  }

  document.getElementById('detailCategory').innerText = evt.category;
  
  let feeText = (evt.feeAmount && evt.feeAmount > 0) ? `${evt.feeName}: ${evt.feeAmount}元` : "免費活動";
  document.getElementById('detailFee').innerText = feeText;
  
  document.getElementById('detailDate').innerText = evt.date;
  
  // 【本次升級】處理詳細介紹與多日課程表
  // 1. 將純文字的換行符號轉為 HTML 的 <br> 讓排版正常
  let safeDescHtml = (evt.description || "尚無詳細說明。").replace(/\n/g, '<br>');
  
  // 2. 如果有「系列活動日程」，自動產生漂亮的課表
  let datesHtml = "";
  if (evt.seriesDates && evt.seriesDates.trim() !== "") {
      try {
          let parsedDates = JSON.parse(evt.seriesDates);
          if (parsedDates.length > 0) {
              datesHtml = `
                <div class="mt-4 p-3 bg-light rounded border shadow-sm">
                  <h6 class="fw-bold text-primary mb-3"><i class="fas fa-list-ol"></i> 課程詳細日程表</h6>
                  <ul class="list-group list-group-flush" style="font-size: 0.85rem;">
              `;
              parsedDates.forEach((d, idx) => {
                  datesHtml += `
                    <li class="list-group-item bg-transparent px-0 py-2 border-bottom border-light">
                      <span class="badge bg-secondary me-2">第 ${idx + 1} 堂</span>
                      <i class="far fa-calendar-alt text-muted"></i> <strong class="text-dark">${d.date}</strong>
                      <i class="far fa-clock text-muted ms-2"></i> ${d.start} ~ ${d.end}
                    </li>
                  `;
              });
              datesHtml += `</ul></div>`;
          }
      } catch (e) {
          console.error("前台解析系列日程失敗", e);
      }
  }

  // 3. 組合介紹文字與課表 (因為包含 HTML，所以改用 innerHTML 寫入)
  document.getElementById('detailDescription').innerHTML = safeDescHtml + datesHtml;

  document.getElementById('btn-detail-register').onclick = function() {
      bootstrap.Modal.getInstance(document.getElementById('eventDetailModal')).hide();
      openRegModal(eventId);
  };

  new bootstrap.Modal(document.getElementById('eventDetailModal')).show();
}
function openRegModal(eventId) {
  const evt = globalActiveEvents.find(e => e.id === eventId);
  if(!evt) return;

  document.getElementById('regEventId').value = evt.id; 
  document.getElementById('regEventName').innerText = evt.name;
  
  const proxyOption = document.getElementById('opt-proxy');
  if (evt.allowProxy) { 
    proxyOption.style.display = 'block'; 
  } else { 
    proxyOption.style.display = 'none'; 
    document.getElementById('regProxyType').value = 'self'; 
  }
  
  document.getElementById('extraInfoSection').style.display = evt.requireExtraInfo ? 'block' : 'none';
  const reqBday = document.getElementById('req-bday');
  if(reqBday) reqBday.style.display = evt.requireExtraInfo ? 'inline' : 'none';

  const container = document.getElementById('dynamicFormContainer');
  const fieldsArea = document.getElementById('dynamicFieldsArea');
  fieldsArea.innerHTML = ''; 

  if (evt.customForm && evt.customForm.trim() !== '') {
      const forms = evt.customForm.split('|');
      forms.forEach((f) => {
          if (f.includes(':')) {
              const parts = f.split(':');
              if(parts.length === 2) {
                  const qName = parts[0].trim();
                  const opts = parts[1].split(',').map(o => o.trim());
                  
                  let selectHtml = `
                    <div class="mb-3">
                      <label class="form-label text-dark fw-bold" style="font-size:0.95rem;">${qName} <span class="text-danger">*</span></label>
                      <select class="form-select border-primary dynamic-select" data-qname="${qName}">
                        <option value="" disabled selected>請選擇${qName}...</option>`;
                  opts.forEach(o => { selectHtml += `<option value="${o}">${o}</option>`; });
                  selectHtml += `</select></div>`;
                  
                  fieldsArea.innerHTML += selectHtml;
              }
          } else if (f.includes('-')) {
              const parts = f.split('-');
              if(parts.length === 2) {
                  const qName = parts[0].trim();
                  const opts = parts[1].split(',').map(o => o.trim());
                  
                  let checkHtml = `
                    <div class="mb-3">
                      <label class="form-label text-dark fw-bold" style="font-size:0.95rem;">${qName} <span class="text-danger">*</span></label>
                      <div class="dynamic-checkbox-group bg-light p-2 rounded border">
                        <div class="row g-2">`;
                  
                  opts.forEach((o, idx) => {
                      const cId = `chk-${qName}-${idx}`;
                      checkHtml += `
                        <div class="col-6">
                          <div class="form-check">
                            <input class="form-check-input dynamic-checkbox" type="checkbox" value="${o}" id="${cId}" data-qname="${qName}">
                            <label class="form-check-label text-muted" for="${cId}">${o}</label>
                          </div>
                        </div>`;
                  });
                  checkHtml += `</div></div></div>`;
                  
                  fieldsArea.innerHTML += checkHtml;
              }
          }
      });
  }
  
  // 【本次新增】影音授權宣告 (永遠顯示在自訂表單最下方)
  let mediaConsentHtml = `
    <div class="mt-4 p-3 bg-white border border-info rounded shadow-sm">
      <div class="form-check">
        <input class="form-check-input border-info shadow-sm" type="checkbox" id="regMediaConsent" checked style="transform: scale(1.2); margin-top: 0.3rem;">
        <label class="form-check-label fw-bold text-dark ms-1" for="regMediaConsent">
          📸 活動影音宣傳授權 <span class="badge bg-info text-white ms-1" style="font-size:0.7rem;">自由勾選</span>
        </label>
        <div class="text-muted mt-2" style="font-size:0.85rem; line-height:1.5;">
          我同意並授權教會於本次活動中拍攝影音，並使用於教會官方媒體上做為宣傳分享。
          <div class="text-danger mt-1" style="font-size:0.8rem; font-weight:bold;">
            (⚠️ 溫馨提醒：若您為「代為報名者」，必須為當事人之法定代理人或 2 等內親屬，方可代為勾選同意。)
          </div>
        </div>
      </div>
    </div>
  `;
  fieldsArea.innerHTML += mediaConsentHtml;
  container.style.display = 'block'; // 強制顯示動態區塊以顯示影音授權
  
  toggleProxyFields(); 
  document.getElementById('regAgree').checked = false;
  new bootstrap.Modal(document.getElementById('regModal')).show();
}
function toggleProxyFields() { 
  const isProxy = document.getElementById('regProxyType').value === 'proxy';
  
  if (!isProxy && currentUserData) {
    document.getElementById('regParticipantName').value = currentUserData.name !== "未綁定會友" ? currentUserData.name : globalUserName;
    document.getElementById('regParticipantPhone').value = currentUserData.phone || "";
    document.getElementById('regParticipantBirthday').value = currentUserData.birthday || "";
  } else {
    document.getElementById('regParticipantName').value = "";
    document.getElementById('regParticipantPhone').value = "";
    document.getElementById('regParticipantBirthday').value = "";
  }
}

// 【方案 B】在送出報名前檢查好友狀態
// 【方案 B】在送出報名前檢查好友狀態
async function submitRegistration() {
  if (!document.getElementById('regAgree').checked) { Swal.fire('提醒', '請先勾選同意收集資料聲明喔！', 'warning'); return; }
  
  const isFriend = await requireLineFriend();
  if (!isFriend) return;

  const isProxy = (document.getElementById('regProxyType').value === 'proxy'); 
  let pName = document.getElementById('regParticipantName').value.trim();
  let pPhone = document.getElementById('regParticipantPhone').value.trim();
  let pBday = document.getElementById('regParticipantBirthday').value;

  if (!pName) { Swal.fire('提醒', '請填寫「參與者真實姓名」！', 'warning'); return; } 
  if (!pPhone) { Swal.fire('提醒', '請填寫「聯絡電話」！', 'warning'); return; } 

  let extraObj = {};
  let missingRequired = false;
  
  document.querySelectorAll('.dynamic-select').forEach(selectEl => {
      const qName = selectEl.getAttribute('data-qname');
      const ans = selectEl.value;
      if (!ans) {
        missingRequired = true;
        Swal.fire('提醒', `請選擇您的「${qName}」！`, 'warning');
      }
      extraObj[qName] = ans;
  });
  if (missingRequired) return;

  let checkMap = {};
  document.querySelectorAll('.dynamic-checkbox:checked').forEach(chkEl => {
      const qName = chkEl.getAttribute('data-qname');
      const ans = chkEl.value;
      if (!checkMap[qName]) checkMap[qName] = [];
      checkMap[qName].push(ans);
  });
  for (let q in checkMap) {
      extraObj[q] = checkMap[q].join(', ');
  }

  if (pBday) extraObj.生日 = pBday; 

  const isExtraRequired = document.getElementById('extraInfoSection').style.display !== 'none';
  if (isExtraRequired) { 
    const idNumber = document.getElementById('regIdNumber').value.trim();
    if (!idNumber || !pBday) { Swal.fire('提醒', '辦理平安險需填寫「身分證與生日」！', 'warning'); return; } 
    extraObj.身分證 = idNumber;
  }
  
  if (document.getElementById('regMemo').value) extraObj.備註 = document.getElementById('regMemo').value;
  
  // 【本次新增】抓取影音宣傳授權狀態
  const mediaConsentElement = document.getElementById('regMediaConsent');
  const mediaConsentChecked = mediaConsentElement ? mediaConsentElement.checked : false;
  
  const btn = document.querySelector('#regModal .btn-primary'); 
  
  const regModalEl = document.getElementById('regModal');
  const regModalInstance = bootstrap.Modal.getInstance(regModalEl);
  if (regModalInstance) regModalInstance.hide();

  Swal.fire({ title: '處理中', text: '正在傳送報名資料...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } });
  
  const gasUrl = window.CONFIG.GAS_URL;
  
  // 【本次新增】將 mediaConsent 打包進 payload 中送出給 API
  const payload = {
      action: 'submitRegistration', 
      eventId: document.getElementById('regEventId').value, 
      uid: currentUID, 
      isProxy: isProxy, 
      participantName: pName, 
      participantPhone: pPhone, 
      extraInfoStr: JSON.stringify(extraObj),
      mediaConsent: mediaConsentChecked
  };

  fetch(gasUrl, { method: 'POST', body: JSON.stringify(payload) })
  .then(res => res.json()).then(res => { 
    if (res.success) { 
      clearCache(); 
      document.getElementById('regForm').reset(); 

      if (!isProxy) {
        if (currentUserData.found) { 
          if (pPhone !== currentUserData.phone || pBday !== currentUserData.birthday) {
            Swal.fire({
              title: '🎉 報名成功！',
              html: '系統發現您的<b>電話或生日</b>與原紀錄不同。<br>是否要一併校正您的個人基本資料？',
              icon: 'success', showCancelButton: true, confirmButtonText: '一併校正', cancelButtonText: '暫不更新', confirmButtonColor: '#28a745'
            }).then((result) => {
              if (result.isConfirmed) {
                fetch(gasUrl, { method: 'POST', body: JSON.stringify({ action: 'saveProfile', uid: currentUID, phone: pPhone, birthday: pBday, groups: currentUserData.groups, service: currentUserData.service }) })
                .then(()=> { clearCache(); window.location.reload(); });
              } else { window.location.reload(); }
            });
            return; 
          }
        } else {
          Swal.fire({
            title: '🎉 報名成功！',
            html: '您目前尚未綁定會友資料。<br>是否使用剛剛填寫的資料，<b>一鍵免費升級為「綁定用戶」</b>？<br>未來報名不需重填，還可解鎖學習護照！',
            icon: 'success', showCancelButton: true, confirmButtonText: '一鍵升級', cancelButtonText: '下次再說', confirmButtonColor: '#f39c12'
          }).then((result) => {
            if (result.isConfirmed) {
              fetch(gasUrl, { method: 'POST', body: JSON.stringify({ action: 'bindUser', uid: currentUID, lineName: globalUserName, realName: pName, phone: pPhone, birthday: pBday }) })
              .then(()=> { clearCache(); window.location.reload(); });
            } else { window.location.reload(); }
          });
          return; 
        }
      }

      Swal.fire('報名成功', res.message, 'success').then(() => { window.location.reload(); }); 
    } else { 
      Swal.fire('報名失敗', res.message, 'error').then(() => {
        if (regModalInstance) regModalInstance.show();
      }); 
    } 
  }).catch(err => { 
    Swal.fire('連線錯誤', err.message, 'error').then(() => {
        if (regModalInstance) regModalInstance.show();
    }); 
  });
}
function cancelRegistration(regId, eventName) {
  Swal.fire({ title: '確定取消報名嗎？', html: `活動：<b>${eventName}</b><br>取消後將釋出您的名額。`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc3545', cancelButtonColor: '#6c757d', confirmButtonText: '是的，我要取消', cancelButtonText: '保留名額' }).then((result) => {
    if (result.isConfirmed) {
      Swal.fire({ title: '處理中', text: '正在取消報名...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } });
      const gasUrl = window.CONFIG.GAS_URL;
      fetch(gasUrl, { method: 'POST', body: JSON.stringify({ action: 'cancelRegistrationUser', regId: regId, uid: currentUID }) }).then(res => res.json()).then(res => { if (res.success) { clearCache(); Swal.fire('已取消', res.message, 'success').then(() => { window.location.reload(); }); } else { Swal.fire('錯誤', res.message, 'error'); } }).catch(err => { Swal.fire('連線錯誤', err.message, 'error'); });
    }
  });
}

function checkInEvent(regId, eventName) {
    Swal.fire({
        title: '確認簽到',
        html: `您即將進行 <b>${eventName}</b> 的數位簽到。<br>簽到後即代表您已出席。`,
        icon: 'info',
        showCancelButton: true,
        confirmButtonColor: '#28a745',
        confirmButtonText: '確定簽到',
        cancelButtonText: '稍後再簽'
    }).then((result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: '處理中', text: '正在寫入簽到紀錄...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } });
            const gasUrl = window.CONFIG.GAS_URL;
            fetch(gasUrl, { method: 'POST', body: JSON.stringify({ action: 'checkInUser', regId: regId, uid: currentUID }) })
            .then(res => res.json())
            .then(res => { 
                if (res.success) { 
                    clearCache(); 
                    Swal.fire('簽到成功', res.message, 'success').then(() => { window.location.reload(); }); 
                } else { 
                    Swal.fire('錯誤', res.message, 'error'); 
                } 
            }).catch(err => { Swal.fire('連線錯誤', err.message, 'error'); });
        }
    });
}

function openFeedbackModal(regId, eventId, eventName) {
    document.getElementById('fbRegId').value = regId;
    document.getElementById('fbEventId').value = eventId;
    document.getElementById('fbEventName').innerText = eventName;
    document.getElementById('feedbackForm').reset();
    new bootstrap.Modal(document.getElementById('feedbackModal')).show();
}

function submitFeedbackModal() {
    const regId = document.getElementById('fbRegId').value;
    const eventId = document.getElementById('fbEventId').value;
    const feedbackText = document.getElementById('fbContent').value.trim();
    
    let stars = 0;
    const starRadios = document.getElementsByName('rating');
    for (let i = 0; i < starRadios.length; i++) {
        if (starRadios[i].checked) {
            stars = parseInt(starRadios[i].value, 10);
            break;
        }
    }

    if (stars === 0) {
        Swal.fire('提醒', '請先點選星星給予評分喔！', 'warning');
        return;
    }

    const btn = document.querySelector('#feedbackModal .btn-warning');
    
    const fbModalEl = document.getElementById('feedbackModal');
    const fbModalInstance = bootstrap.Modal.getInstance(fbModalEl);
    if (fbModalInstance) fbModalInstance.hide();

    Swal.fire({ title: '傳送中', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } });

    const gasUrl = window.CONFIG.GAS_URL;
    fetch(gasUrl, { 
        method: 'POST', 
        body: JSON.stringify({ action: 'submitFeedback', regId: regId, uid: currentUID, eventId: eventId, stars: stars, feedbackText: feedbackText }) 
    })
    .then(res => res.json()).then(res => {
        if (res.success) {
            clearCache();
            Swal.fire('非常感謝', res.message, 'success').then(() => { window.location.reload(); });
        } else {
            Swal.fire('錯誤', res.message, 'error').then(() => {
                if (fbModalInstance) fbModalInstance.show();
                btn.innerHTML = '<i class="fas fa-paper-plane"></i> 送出回饋';
            });
        }
    }).catch(err => { 
        Swal.fire('連線錯誤', err.message, 'error').then(() => {
            if (fbModalInstance) fbModalInstance.show();
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> 送出回饋'; 
        });
    });
}

// ========================================================
// 【新增】教會整體預算進度與健康度渲染引擎
// ========================================================
function renderChurchHealth(churchFinance, sysYear) {
    const container = document.getElementById('church-health-card');
    const content = document.getElementById('church-health-content');
    
    if (!container || !content || !churchFinance || churchFinance.budget <= 0) {
        if(container) container.style.display = 'none';
        return;
    }

    const targetYear = Number(sysYear);
    const budget = churchFinance.budget;
    const currentTotal = churchFinance.total;
    
    const now = new Date();
    const currentYear = now.getFullYear();
    let totalDays = (targetYear % 4 === 0 && targetYear % 100 !== 0) || (targetYear % 400 === 0) ? 366 : 365;
    let daysPassed = 0;

    if (targetYear < currentYear) {
        daysPassed = totalDays; 
    } else if (targetYear === currentYear) {
        const start = new Date(currentYear, 0, 0);
        daysPassed = Math.floor((now - start) / (1000 * 60 * 60 * 24)); 
    }

    const expectedTarget = Math.round((budget / totalDays) * daysPassed);
    let healthRatio = expectedTarget > 0 ? (currentTotal / expectedTarget) * 100 : (currentTotal > 0 ? 100 : 0);
    let visualRatio = budget > 0 ? (currentTotal / budget) * 100 : 0;
    if (visualRatio > 100) visualRatio = 100;

    // 【修改】全新定義的三階段健康度與文案
    let colorClass = "bg-danger"; 
    let statusText = "嚴重落後";
    let icon = "fa-exclamation-circle text-danger";
    
    if (healthRatio >= 70) {
        colorClass = "bg-success"; 
        statusText = "安全範圍"; 
        icon = "fa-check-circle text-success";
    } else if (healthRatio >= 50) {
        colorClass = "bg-warning"; 
        statusText = "警戒範圍"; 
        icon = "fa-exclamation-triangle text-warning";
    }

    if (daysPassed === 0) { 
        statusText = "年度尚未開始"; 
        icon = "fa-info-circle text-muted"; 
        colorClass = "bg-secondary"; 
    }

    content.innerHTML = `
      <div class="d-flex justify-content-between align-items-end mb-1" style="font-size:0.85rem;">
        <span class="text-muted fw-bold">總預算 $${budget.toLocaleString()}</span>
        <span class="fw-bold" style="cursor: pointer;" data-bs-toggle="modal" data-bs-target="#healthInfoModal">
            <i class="fas ${icon}"></i> ${statusText} <i class="fas fa-question-circle ms-1 text-muted"></i>
        </span>
      </div>
      <div class="progress mb-2" style="height: 12px; background-color:#e9ecef; border-radius: 10px;">
        <div class="progress-bar progress-bar-striped progress-bar-animated ${colorClass}" role="progressbar" style="width: ${visualRatio}%;"></div>
      </div>
      <div class="d-flex justify-content-between text-muted" style="font-size:0.75rem;">
        <span>累積奉獻: <strong class="text-dark">$${currentTotal.toLocaleString()}</strong></span>
        <span>當前應達標: $${expectedTarget.toLocaleString()} <strong class="text-dark">(${healthRatio.toFixed(1)}%)</strong></span>
      </div>
    `;
    container.style.display = 'block'; 
}

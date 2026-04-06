// admin.js - 專屬於後台的輕量化邏輯，嚴格隔離以確保資訊安全

let currentUID = ""; 
let adminData = null;

// 全域變數庫
let currentModalList = []; 
let currentReportData = [];
let currentReportEventInfo = null; 
let memberModalInstance = null;

// 全教會名單與管理員快取
let allMembersCache = [];
let adminRolesCache = [];

// 【第四包新增】全域圖表變數
let myAdminDonationCatChart = null;
let myAdminDonationTrendChart = null;

// 【第五包新增】財務預覽全域變數
let currentFinancePreviewData = [];

// ====== 【防呆啟動引擎】 ======
function initAdminSystem() {
  const loadingEl = document.getElementById('loading');
  if (loadingEl) loadingEl.style.display = 'flex';
  
  if (typeof window.CONFIG === 'undefined') {
      console.warn("等待 config.js 載入中...");
      setTimeout(initAdminSystem, 100);
      return;
  }

  const liffId = window.CONFIG.LIFF_ID;
  if (!liffId) { Swal.fire('系統錯誤', '未設定 LIFF ID！', 'error'); if(loadingEl) loadingEl.style.display = 'none'; return; }

  liff.init({ liffId: liffId }).then(() => {
    if (!liff.isLoggedIn()) { window.location.href = 'index.html'; } 
    else {
      liff.getProfile().then(profile => {
        currentUID = profile.userId;
        verifyAdminAuth(currentUID); 
      }).catch(err => Swal.fire('錯誤', '無法取得 LINE 帳號資料', 'error'));
    }
  }).catch((err) => Swal.fire('錯誤', 'LIFF 啟動失敗', 'error'));
}

if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", initAdminSystem);
} else {
    initAdminSystem(); 
}
// ==========================================

window.forceAdminRefresh = function() {
  Swal.fire({ title: '重新載入中', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  window.location.href = window.location.pathname + '?t=' + new Date().getTime();
};

function verifyAdminAuth(uid) {
  console.log("🛡️ 向伺服器驗證管理員權限中...");
  const gasUrl = window.CONFIG.GAS_URL;
  fetch(`${gasUrl}?action=getUser&uid=${uid}`)
    .then(async res => {
      const text = await res.text();
      try { return JSON.parse(text); } catch(e) { throw new Error("<span style='color:red; font-size:0.85rem;'>伺服器回傳異常：</span><br>" + text.substring(0, 150).replace(/</g, "&lt;")); }
    })
    .then(response => {
      if (response.isAdmin) {
        adminData = response;
        document.getElementById('loading').style.display = 'none';
        document.getElementById('ui-adminName').innerText = `${response.name} (${response.adminLevel})`;
        
        const yInput = document.getElementById('finance-year-input');
        if(yInput && response.sysYear) yInput.value = response.sysYear;
        
        applyRBAC(); 
      } else {
        document.getElementById('loading').style.display = 'none';
        Swal.fire({ title: '門禁管制', text: '抱歉，您沒有進入管理後台的權限喔！', icon: 'error', confirmButtonColor: '#8e44ad', confirmButtonText: '返回首頁', allowOutsideClick: false }).then(() => { window.location.href = 'index.html'; });
      }
    }).catch(err => {
      document.getElementById('loading').style.display = 'none';
      Swal.fire({ title: '資料庫連線失敗', html: err.message, icon: 'error' });
    });
}

// ========== 👇 從這裡開始替換 applyRBAC 函式 👇 ==========
function applyRBAC() {
  const lvl = adminData.adminLevel;
  console.log("當前管理員身分：", lvl);

  loadBroadcastForm();
  loadAdminEventList();
  if (typeof populateGroupIdDatalist === 'function') populateGroupIdDatalist(); 

  if (lvl === "超級管理員") {
    document.getElementById('nav-tab-roles').classList.remove('auth-hidden');
    document.getElementById('nav-tab-finance').classList.remove('auth-hidden');
    document.getElementById('btn-toggle-create').classList.remove('auth-hidden'); 
    document.getElementById('btn-toggle-manage').classList.remove('auth-hidden');
    document.getElementById('btn-toggle-archive').classList.remove('auth-hidden');
    loadDashboard(); loadSystemSettings(); loadAllMembers(); loadAdminRoles(); loadFinancialSummary();
  } else if (lvl === "最高管理員") {
    document.getElementById('nav-tab-finance').classList.remove('auth-hidden');
    document.getElementById('btn-toggle-create').classList.remove('auth-hidden');
    document.getElementById('btn-toggle-manage').classList.remove('auth-hidden');
    document.getElementById('btn-toggle-archive').classList.remove('auth-hidden');
    loadDashboard(); loadSystemSettings(); loadAllMembers(); loadFinancialSummary();
  } else if (lvl === "活動管理員") {
    document.getElementById('nav-tab-dashboard').classList.add('auth-hidden');
    document.getElementById('nav-tab-settings').classList.add('auth-hidden');
    document.getElementById('nav-tab-members').classList.add('auth-hidden');
    document.getElementById('nav-tab-finance').classList.add('auth-hidden'); // 隱藏財務
    document.getElementById('btn-toggle-create').classList.remove('auth-hidden');
    document.getElementById('btn-toggle-manage').classList.remove('auth-hidden');
    document.getElementById('btn-toggle-archive').classList.remove('auth-hidden');
    switchAdminTab(null, 'events'); 
  } else if (lvl === "財務管理員") {
    document.getElementById('nav-tab-dashboard').classList.add('auth-hidden');
    document.getElementById('nav-tab-events').classList.add('auth-hidden');
    document.getElementById('nav-tab-broadcast').classList.add('auth-hidden');
    document.getElementById('nav-tab-settings').classList.add('auth-hidden');
    document.getElementById('nav-tab-members').classList.add('auth-hidden'); // 隱藏會友個資
    document.getElementById('nav-tab-finance').classList.remove('auth-hidden'); // 顯示獨立的財務
    switchAdminTab(null, 'finance'); // 登入直接跳轉至財務頁面
    loadFinancialSummary();
  } else {
    // 一般同工
    document.getElementById('nav-tab-events').classList.add('auth-hidden');
    document.getElementById('nav-tab-settings').classList.add('auth-hidden');
    document.getElementById('nav-tab-finance').classList.add('auth-hidden');
    loadDashboard(); loadAllMembers();
  }
}
// ========== 👆 替換到這裡為止 👆 ==========

function switchAdminTab(event, tabId) {
  if (event) event.preventDefault(); 
  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
  if (event && event.currentTarget) { event.currentTarget.classList.add('active'); } else {
    const navEl = document.getElementById('nav-tab-' + tabId);
    if (navEl) { const linkEl = navEl.querySelector('.nav-link'); if (linkEl) linkEl.classList.add('active'); }
  }
  document.querySelectorAll('.admin-section').forEach(sec => sec.classList.remove('active'));
  const tabEl = document.getElementById('tab-' + tabId);
  if (tabEl) tabEl.classList.add('active');
}

// ==========================================
// 載入與渲染儀表板數據 (Tab 1)
// ==========================================
function loadDashboard() {
  const dashContainer = document.getElementById('tab-dashboard');
  const gasUrl = window.CONFIG.GAS_URL;
  fetch(`${gasUrl}?action=getAdminDashboard&uid=${currentUID}`)
    .then(res => res.json())
    .then(res => {
      if (res.success) renderDashboard(res);
      else dashContainer.innerHTML = `<div class="alert alert-danger">${res.message}</div>`;
    }).catch(err => dashContainer.innerHTML = `<div class="alert alert-danger">連線失敗：${err.message}</div>`);
}

function renderDashboard(data) {
  let html = `
    <div class="row mb-3">
      <div class="col-6">
        <div class="card p-3 text-center border-0 shadow-sm h-100 clickable-card" style="border-left: 4px solid #3498db !important;" onclick="showMemberList('NewMembers')">
          <h6 class="text-muted mb-1" style="font-size: 0.8rem;"><i class="fas fa-user-plus text-primary"></i> 本月新增會友</h6>
          <h3 class="fw-bold text-dark mb-0">${data.stats.newMembersThisMonth} <span style="font-size:0.8rem">人</span></h3>
        </div>
      </div>
      <div class="col-6">
        <div class="card p-3 text-center border-0 shadow-sm h-100 clickable-card" style="border-left: 4px solid #e74c3c !important;" onclick="showMemberList('Birthday')">
          <h6 class="text-muted mb-1" style="font-size: 0.8rem;"><i class="fas fa-birthday-cake text-danger"></i> 本月壽星</h6>
          <h3 class="fw-bold text-dark mb-0">${data.stats.birthdayThisMonth} <span style="font-size:0.8rem">人</span></h3>
        </div>
      </div>
    </div>
    
    <div class="row mb-4">
      <div class="col-4 px-2">
        <div class="card p-2 text-center border-0 shadow-sm h-100 bg-light clickable-card" onclick="showMemberList('Tier 0')">
          <h6 class="text-muted mb-0" style="font-size: 0.75rem;">Tier 0</h6>
          <h5 class="fw-bold text-secondary mb-0 mt-1">${data.stats.tier0Count}</h5>
        </div>
      </div>
      <div class="col-4 px-2">
        <div class="card p-2 text-center border-0 shadow-sm h-100 bg-light clickable-card" onclick="showMemberList('Tier 1')">
          <h6 class="text-muted mb-0" style="font-size: 0.75rem;">Tier 1</h6>
          <h5 class="fw-bold text-primary mb-0 mt-1">${data.stats.tier1Count}</h5>
        </div>
      </div>
      <div class="col-4 px-2">
        <div class="card p-2 text-center border-0 shadow-sm h-100 bg-light clickable-card" onclick="showMemberList('Tier 2')">
          <h6 class="text-muted mb-0" style="font-size: 0.75rem;">Tier 2</h6>
          <h5 class="fw-bold text-success mb-0 mt-1">${data.stats.tier2Count}</h5>
        </div>
      </div>
    </div>

    <h6 class="fw-bold text-dark mb-3"><i class="fas fa-file-invoice-dollar text-success"></i> 待處理財務開通申請 <span class="badge bg-danger rounded-pill">${data.stats.pendingFinanceCount}</span></h6>
    <div class="list-group shadow-sm border-0 mb-4">
  `;

  if (data.pendingFinanceRequests && data.pendingFinanceRequests.length > 0) {
      data.pendingFinanceRequests.forEach(f => {
          html += `
            <div class="list-group-item p-3 border-0 border-bottom">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="fw-bold text-success" style="font-size: 1.1rem;">${f.name}</span>
                <small class="text-muted">${f.applyTime} 申請</small>
              </div>
              <div class="mb-3 text-dark" style="font-size: 0.9rem;">
                <i class="fas fa-phone-alt w-20px text-muted"></i> ${f.phone}
              </div>
              <button class="btn btn-sm btn-outline-success rounded-pill w-100 fw-bold py-2" onclick="approveFinanceAccess('${f.uid}', '${f.name}')">
                <i class="fas fa-user-check"></i> 處理並一鍵開通 (升級 Tier 2)
              </button>
            </div>`;
      });
  } else {
      html += `<div class="list-group-item p-4 text-center text-muted border-0">目前無待開通的財務申請 💰</div>`;
  }
  html += `</div>`;
    
  html += `<h6 class="fw-bold text-dark mb-3"><i class="fas fa-praying-hands text-warning"></i> 待處理代禱事項 <span class="badge bg-danger rounded-pill">${data.stats.pendingPrayerCount}</span></h6>
    <div class="list-group shadow-sm border-0 mb-4">`;
  
  if (data.pendingPrayers && data.pendingPrayers.length > 0) {
      data.pendingPrayers.forEach(p => {
          let badge = p.isPublic === "公開" ? `<span class="badge bg-info">公開</span>` : `<span class="badge bg-secondary">保密</span>`;
          html += `
            <div class="list-group-item p-3 border-0 border-bottom">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="fw-bold text-primary" style="font-size: 1.1rem;">${p.name}</span>
                <small class="text-muted">${p.time}</small>
              </div>
              <div class="mb-2 text-dark" style="font-size: 0.9rem;">${badge} <strong class="ms-1">對象：</strong>${p.target}</div>
              <div class="mb-3 p-3 bg-light rounded text-dark" style="font-size: 0.95rem; white-space: pre-wrap; border-left: 3px solid #f39c12;">${p.content}</div>
              <div class="mt-2">
                <textarea id="reply-${p.rowId}" class="form-control mb-2" rows="2" placeholder="牧者勉勵回覆... (送出後推播給會友)"></textarea>
                <button class="btn btn-sm btn-success rounded-pill w-100 fw-bold py-2" onclick="markPrayerDone(${p.rowId})">
                  <i class="fas fa-check"></i> 標記已代禱 (並發送通知)
                </button>
              </div>
            </div>`;
      });
  } else {
      html += `<div class="list-group-item p-4 text-center text-muted border-0">目前沒有未處理的代禱事項 🙏</div>`;
  }
  document.getElementById('tab-dashboard').innerHTML = html + `</div>`;
}

function approveFinanceAccess(targetUid, targetName) {
  Swal.fire({
    title: `核准開通：${targetName}`,
    html: `
      <div class="text-start mt-2">
        <p class="text-muted mb-3" style="font-size:0.85rem;">請輸入該會友的「奉獻代碼」，系統將自動擷取「家庭編號」並將其升級為 Tier 2。</p>
        <label class="form-label fw-bold text-success">奉獻代碼</label>
        <input type="text" id="finance-code-input" class="form-control mb-3" placeholder="例如：0198-1">
      </div>
    `,
    showCancelButton: true, confirmButtonText: '確定開通', cancelButtonText: '取消', confirmButtonColor: '#28a745',
    preConfirm: () => {
      const code = document.getElementById('finance-code-input').value.trim();
      if (!code) Swal.showValidationMessage('請輸入奉獻代碼！');
      return code;
    }
  }).then((result) => {
    if (result.isConfirmed) {
      const dCode = result.value;
      const fId = dCode.split('-')[0]; 
      Swal.fire({ title: '處理中', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const gasUrl = window.CONFIG.GAS_URL;
      fetch(gasUrl, { 
        method: 'POST', 
        body: JSON.stringify({ action: 'approveFinanceAccess', adminUid: currentUID, targetUid: targetUid, donationCode: dCode, familyId: fId }) 
      })
      .then(res => res.json()).then(res => {
        if (res.success) Swal.fire('開通成功', `已將 ${targetName} 升級為 Tier 2！`, 'success').then(() => loadDashboard());
        else Swal.fire('錯誤', res.message, 'error');
      }).catch(err => Swal.fire('連線錯誤', err.message, 'error'));
    }
  });
}

function markPrayerDone(rowId) {
  const replyText = document.getElementById(`reply-${rowId}`).value.trim();
  Swal.fire({
    title: '確認處理完畢？', html: replyText ? `即將標記為已處理，並將勉勵推播。` : `目前無填寫勉勵，將直接標記為已代禱。`,
    icon: 'question', showCancelButton: true, confirmButtonColor: '#28a745', confirmButtonText: '是的，已處理'
  }).then((result) => {
    if (result.isConfirmed) {
      Swal.fire({ title: '處理中', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const gasUrl = window.CONFIG.GAS_URL;
      fetch(gasUrl, { method: 'POST', body: JSON.stringify({ action: 'markPrayerDone', uid: currentUID, rowId: rowId, replyText: replyText }) })
        .then(res => res.json()).then(res => {
          if(res.success) { Swal.fire('成功', res.message, 'success').then(()=>loadDashboard()); } 
          else { Swal.fire('錯誤', res.message, 'error'); }
        }).catch(err => Swal.fire('連線錯誤', err.message, 'error'));
    }
  });
}

function getMemberModal() {
  if (!memberModalInstance) memberModalInstance = new bootstrap.Modal(document.getElementById('memberListModal'));
  return memberModalInstance;
}
function showMemberList(filterType) {
  let title = `📊 ${filterType} 名單`;
  if (filterType === 'Birthday') title = '🎂 本月壽星名單';
  if (filterType === 'NewMembers') title = '🎉 本月新增綁定會友'; 
  
  document.getElementById('memberListModalLabel').innerHTML = title;
  document.getElementById('member-list-tbody').innerHTML = '';
  document.getElementById('modal-loading').style.display = 'block';
  getMemberModal().show();

  const gasUrl = window.CONFIG.GAS_URL;
  fetch(`${gasUrl}?action=getAdminMemberList&uid=${currentUID}&filter=${filterType}`)
    .then(res => res.json())
    .then(res => {
      document.getElementById('modal-loading').style.display = 'none';
      if (res.success) { currentModalList = res.list; renderMemberListTable(res.list, filterType); } 
      else document.getElementById('member-list-tbody').innerHTML = `<tr><td colspan="3" class="text-danger">${res.message}</td></tr>`;
    }).catch(err => document.getElementById('member-list-tbody').innerHTML = `<tr><td colspan="3" class="text-danger">撈取失敗</td></tr>`);
}
function renderMemberListTable(list, currentFilter) {
  const tbody = document.getElementById('member-list-tbody');
  if (list.length === 0) { tbody.innerHTML = '<tr><td colspan="3" class="text-muted py-4">無符合條件的會友</td></tr>'; return; }
  
  let html = '';
  list.forEach((user, index) => {
    let badgeClass = user.tier === 'Tier 2' ? 'success' : (user.tier === 'Tier 1' ? 'primary' : 'secondary');
    html += `<tr>
      <td class="text-start"><div class="fw-bold text-dark">${user.name}</div><div class="text-muted" style="font-size:0.8rem">${user.phone}</div></td>
      <td><span class="badge bg-${badgeClass} mb-1">${user.tier}</span><br><span class="text-muted" style="font-size:0.75rem">${user.service || '無服事'} / ${user.groups || '無團契'}</span></td>
      <td>
        <button class="btn btn-sm btn-outline-primary mb-1" onclick="editUserSimple(${index}, '${currentFilter}')"><i class="fas fa-edit"></i> 簡易修改</button>
        <button class="btn btn-sm btn-outline-info mb-1" onclick="directMessageUser('${user.uid}', '${user.name}')"><i class="fas fa-comment-dots"></i> 私訊</button>
      </td>
    </tr>`;
  });
  tbody.innerHTML = html;
}

function editUserSimple(index, currentFilter) {
  getMemberModal().hide();
  let user = currentModalList[index];
  Swal.fire({
    title: `快速調整等級：${user.name}`,
    html: `
      <div class="text-start mt-2">
        <label class="form-label fw-bold text-primary">帳號等級</label>
        <select id="edit-tier" class="form-select mb-3">
          <option value="Tier 0" ${user.tier === 'Tier 0' ? 'selected' : ''}>Tier 0 (一般未綁定)</option>
          <option value="Tier 1" ${user.tier === 'Tier 1' ? 'selected' : ''}>Tier 1 (已綁定)</option>
          <option value="Tier 2" ${user.tier === 'Tier 2' ? 'selected' : ''}>Tier 2 (財務驗證)</option>
        </select>
        <div class="alert alert-light text-muted p-2" style="font-size:0.85rem;">
          <i class="fas fa-info-circle text-primary"></i> 若需調整團契或服事單位，請前往「會友」分頁使用完整編輯功能。
        </div>
      </div>`,
    showCancelButton: true, confirmButtonText: '儲存', cancelButtonText: '取消', confirmButtonColor: '#28a745'
  }).then((result) => {
    if (result.isConfirmed) {
      Swal.fire({ title: '儲存中', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const gasUrl = window.CONFIG.GAS_URL;
      fetch(gasUrl, { 
        method: 'POST', 
        body: JSON.stringify({ 
          action: 'adminUpdateUser', adminUid: currentUID, targetUid: user.uid, 
          tier: document.getElementById('edit-tier').value, 
          service: user.service, 
          groups: user.groups 
        }) 
      })
      .then(res => res.json()).then(res => {
        if (res.success) Swal.fire('成功', '資料已更新', 'success').then(() => showMemberList(currentFilter));
        else Swal.fire('錯誤', res.message, 'error').then(() => getMemberModal().show());
      });
    } else getMemberModal().show();
  });
}

function directMessageUser(targetUid, targetName) {
  if (memberModalInstance) getMemberModal().hide();
  Swal.fire({
    title: `💬 私訊給 ${targetName}`, input: 'textarea', inputPlaceholder: '支援使用 {name} 變數...',
    showCancelButton: true, confirmButtonText: '確定發送', confirmButtonColor: '#8e44ad',
    preConfirm: (text) => { if (!text || text.trim() === '') Swal.showValidationMessage('內容不能為空喔！'); return text.trim(); }
  }).then((result) => {
    if (result.isConfirmed) {
      let finalMsg = result.value.replace(/{name}/g, targetName);
      Swal.fire({ title: '發送中', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const gasUrl = window.CONFIG.GAS_URL;
      fetch(gasUrl, { method: 'POST', body: JSON.stringify({ action: 'sendBroadcast', uid: currentUID, targetGroup: 'UID:' + targetUid, messageContent: finalMsg, attachEventId: '無' }) })
      .then(res => res.json()).then(res => {
        if (res.success) Swal.fire('發送成功！', `已成功發送給 ${targetName}。`, 'success').then(() => { if (memberModalInstance) getMemberModal().show(); });
        else Swal.fire('發送失敗', res.message, 'error').then(() => { if (memberModalInstance) getMemberModal().show(); });
      });
    } else { if (memberModalInstance) getMemberModal().show(); }
  });
}

// ==========================================
// 全教會名單與進階編輯器 (Tab 5 專用)
// ==========================================
function loadAllMembers() {
  document.getElementById('full-member-loading').style.display = 'block';
  document.getElementById('full-member-list').style.display = 'none';

  const filterGroup = document.getElementById('filter-group');
  filterGroup.innerHTML = '<option value="">所有團契</option>';
  if (adminData.availableGroups) {
    adminData.availableGroups.forEach(g => filterGroup.innerHTML += `<option value="${g}">${g}</option>`);
  }

  const gasUrl = window.CONFIG.GAS_URL;
  fetch(`${gasUrl}?action=getAllMembers&uid=${currentUID}`)
    .then(res => res.json())
    .then(res => {
      document.getElementById('full-member-loading').style.display = 'none';
      if (res.success) {
        allMembersCache = res.list;
        filterFullMemberList(); 
        
        if (adminData.adminLevel === "超級管理員") {
           const roleSelect = document.getElementById('role-user-select');
           roleSelect.innerHTML = '<option value="">請選擇要升級的會友...</option>';
           allMembersCache.forEach(u => {
              let tail = u.phone.length > 3 ? u.phone.slice(-3) : u.phone;
              roleSelect.innerHTML += `<option value="${u.uid}">${u.name} (尾碼 ${tail})</option>`;
           });
        }
      } else {
        document.getElementById('full-member-list').innerHTML = `<div class="alert alert-danger">${res.message}</div>`;
        document.getElementById('full-member-list').style.display = 'block';
      }
    }).catch(err => {
      document.getElementById('full-member-loading').style.display = 'none';
      document.getElementById('full-member-list').innerHTML = `<div class="alert alert-danger">連線失敗</div>`;
      document.getElementById('full-member-list').style.display = 'block';
    });
}

function filterFullMemberList() {
  const searchInput = document.getElementById('member-search-input').value.trim().toLowerCase();
  const keywords = searchInput ? searchInput.split(/\s+/) : []; 
  const tFilter = document.getElementById('filter-tier').value;
  const gFilter = document.getElementById('filter-group').value;
  const bFilter = document.getElementById('filter-baptism').value;

  const filtered = allMembersCache.filter(u => {
    let match = true;
    if (keywords.length > 0) {
      const searchStr = u.name.toLowerCase() + " " + String(u.phone);
      let allKwMatch = keywords.every(kw => searchStr.includes(kw));
      if (!allKwMatch) match = false;
    }
    if (tFilter && u.tier !== tFilter) match = false;
    if (gFilter && !String(u.groups).includes(gFilter)) match = false;
    if (bFilter && u.baptism !== bFilter) match = false;
    return match;
  });

  document.getElementById('total-member-count').innerText = `共 ${filtered.length} 人`;
  const container = document.getElementById('full-member-list');
  container.innerHTML = '';

  if (filtered.length === 0) {
    container.innerHTML = '<div class="text-center text-muted py-4">查無符合條件的會友</div>';
  } else {
    filtered.forEach(u => {
      let bClass = u.tier === 'Tier 2' ? 'success' : (u.tier === 'Tier 1' ? 'primary' : 'secondary');
      container.innerHTML += `
        <div class="list-group-item p-3 border-bottom border-0">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <h6 class="fw-bold text-dark mb-0">${u.name} <span class="badge bg-${bClass} ms-1" style="font-size:0.6rem;">${u.tier}</span></h6>
            <div class="text-muted" style="font-size:0.75rem;">UID: <span style="font-family:monospace;">${u.uid.substring(0,8)}...</span> <i class="fas fa-copy text-primary ms-1" style="cursor:pointer;" onclick="copyUID('${u.uid}')" title="複製完整 UID"></i></div>
          </div>
          <div class="text-muted mb-2" style="font-size:0.85rem;">
            <i class="fas fa-phone-alt w-20px"></i> ${u.phone} | <i class="fas fa-birthday-cake w-20px"></i> ${u.birthday || '未填寫'} <br>
            <i class="fas fa-church w-20px"></i> 團契: ${u.groups || '無'} | 服事: ${u.service || '無'} <br>
            <i class="fas fa-hand-holding-usd w-20px"></i> 奉獻編號: ${u.donationCode || '無'} 
          </div>
          <div class="text-end mt-2">
            <button class="btn btn-sm btn-outline-primary rounded-pill px-3 shadow-sm" onclick='openFullEditModal(${JSON.stringify(u)})'><i class="fas fa-user-edit"></i> 完整編輯</button>
            <button class="btn btn-sm btn-outline-info rounded-pill px-3 shadow-sm" onclick="directMessageUser('${u.uid}', '${u.name}')"><i class="fas fa-paper-plane"></i> 私訊</button>
          </div>
        </div>
      `;
    });
  }
  container.style.display = 'block';
}

function copyUID(uid) {
  navigator.clipboard.writeText(uid).then(() => {
    Swal.fire({title: '已複製 UID', text: uid, icon: 'success', timer: 1500, showConfirmButton: false});
  });
}

function openFullEditModal(userObj) {
  let groupHtml = '';
  if (adminData.availableGroups) {
    let uGrps = (userObj.groups || "").split('、').map(x=>x.trim());
    adminData.availableGroups.forEach((g, idx) => {
      let chk = uGrps.includes(g) ? 'checked' : '';
      groupHtml += `<div class="form-check form-check-inline"><input class="form-check-input fw-group-chk" type="checkbox" value="${g}" id="fgc-${idx}" ${chk}><label class="form-check-label" for="fgc-${idx}">${g}</label></div>`;
    });
  }
  
  let srvHtml = '';
  if (adminData.availableServices) {
    let uSrvs = (userObj.service || "").split('、').map(x=>x.trim());
    adminData.availableServices.forEach((s, idx) => {
      let chk = uSrvs.includes(s) ? 'checked' : '';
      srvHtml += `<div class="form-check form-check-inline"><input class="form-check-input fw-srv-chk" type="checkbox" value="${s}" id="fsc-${idx}" ${chk}><label class="form-check-label" for="fsc-${idx}">${s}</label></div>`;
    });
  }

  Swal.fire({
    title: '編輯完整個資',
    width: '600px',
    html: `
      <div class="text-start" style="font-size:0.9rem;">
        <div class="row g-2 mb-2">
          <div class="col-6"><label class="fw-bold">姓名</label><input type="text" id="fu-name" class="form-control form-control-sm" value="${userObj.name}"></div>
          <div class="col-6"><label class="fw-bold">電話</label><input type="text" id="fu-phone" class="form-control form-control-sm" value="${userObj.phone}"></div>
        </div>
        <div class="row g-2 mb-2">
          <div class="col-6"><label class="fw-bold">生日 (YYYY-MM-DD)</label><input type="text" id="fu-birthday" class="form-control form-control-sm" value="${userObj.birthday}"></div>
          <div class="col-6"><label class="fw-bold">洗禮狀態</label>
            <select id="fu-baptism" class="form-select form-select-sm">
              <option value="慕道友" ${userObj.baptism==='慕道友'?'selected':''}>慕道友</option>
              <option value="小兒洗禮" ${userObj.baptism==='小兒洗禮'?'selected':''}>小兒洗禮</option>
              <option value="堅信禮" ${userObj.baptism==='堅信禮'?'selected':''}>堅信禮</option>
              <option value="成人洗禮" ${userObj.baptism==='成人洗禮'?'selected':''}>成人洗禮</option>
            </select>
          </div>
        </div>
        <div class="row g-2 mb-2">
          <div class="col-6"><label class="fw-bold">帳號等級 (Tier)</label>
            <select id="fu-tier" class="form-select form-select-sm">
              <option value="Tier 0" ${userObj.tier==='Tier 0'?'selected':''}>Tier 0 (一般用戶)</option>
              <option value="Tier 1" ${userObj.tier==='Tier 1'?'selected':''}>Tier 1 (已綁定)</option>
              <option value="Tier 2" ${userObj.tier==='Tier 2'?'selected':''}>Tier 2 (財務驗證)</option>
            </select>
          </div>
          <div class="col-6"><label class="fw-bold">奉獻代碼</label><input type="text" id="fu-donation" class="form-control form-control-sm" value="${userObj.donationCode}"></div>
        </div>
        <div class="row g-2 mb-3">
          <div class="col-6"><label class="fw-bold">家庭編號</label><input type="text" id="fu-family" class="form-control form-control-sm" value="${userObj.familyId}"></div>
          <div class="col-6"><label class="fw-bold">全戶視角權限</label>
            <select id="fu-famView" class="form-select form-select-sm">
              <option value="false" ${String(userObj.familyView)==='false'?'selected':''}>關閉</option>
              <option value="true" ${String(userObj.familyView)==='true'?'selected':''}>開啟 (可看全家奉獻)</option>
            </select>
          </div>
        </div>
        <div class="mb-2"><label class="fw-bold text-primary border-bottom w-100 mb-1">所屬團契/牧區 (可多選)</label><div>${groupHtml}</div></div>
        <div class="mb-2"><label class="fw-bold text-success border-bottom w-100 mb-1">參與服事單位 (可多選)</label><div>${srvHtml}</div></div>
      </div>
    `,
    showCancelButton: true, confirmButtonText: '確定儲存', cancelButtonText: '取消', confirmButtonColor: '#8e44ad'
  }).then((result) => {
    if (result.isConfirmed) {
      let gArr = []; document.querySelectorAll('.fw-group-chk:checked').forEach(c => gArr.push(c.value));
      let sArr = []; document.querySelectorAll('.fw-srv-chk:checked').forEach(c => sArr.push(c.value));
      
      let payload = {
        uid: userObj.uid,
        name: document.getElementById('fu-name').value.trim(),
        phone: document.getElementById('fu-phone').value.trim(),
        birthday: document.getElementById('fu-birthday').value.trim(),
        baptism: document.getElementById('fu-baptism').value,
        tier: document.getElementById('fu-tier').value,
        donationCode: document.getElementById('fu-donation').value.trim(),
        familyId: document.getElementById('fu-family').value.trim(),
        familyView: document.getElementById('fu-famView').value === 'true',
        groups: gArr.join('、'),
        service: sArr.join('、')
      };

      Swal.fire({ title: '儲存中', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const gasUrl = window.CONFIG.GAS_URL;
      fetch(gasUrl, { method: 'POST', body: JSON.stringify({ action: 'adminUpdateFullUser', adminUid: currentUID, userData: payload }) })
        .then(res => res.json()).then(res => {
          if (res.success) Swal.fire('成功', res.message, 'success').then(() => loadAllMembers());
          else Swal.fire('錯誤', res.message, 'error');
        }).catch(err => Swal.fire('錯誤', err.message, 'error'));
    }
  });
}


// ==========================================
// 權限管理控管 (Tab 6，僅超級管理員可見)
// ==========================================
function loadAdminRoles() {
  document.getElementById('admin-role-loading').style.display = 'block';
  document.getElementById('admin-role-table').style.display = 'none';

  const gasUrl = window.CONFIG.GAS_URL;
  fetch(`${gasUrl}?action=getAdminRoles&uid=${currentUID}`)
    .then(res => res.json()).then(res => {
      document.getElementById('admin-role-loading').style.display = 'none';
      if (res.success) {
        adminRolesCache = res.list;
        let tbody = document.getElementById('admin-role-tbody');
        tbody.innerHTML = '';
        res.list.forEach(a => {
          let bClass = a.status === '已啟用' ? 'success' : 'secondary';
          let levelIcon = a.level.includes("最高") ? "🦅" : (a.level.includes("活動") ? "🎟️" : (a.level.includes("財務") ? "💰" : "📋"));
          if(a.level === "超級管理員") levelIcon = "👑";

          let actionHtml = `<i class="fas fa-bell fa-lg text-info mx-2" style="cursor:pointer;" onclick="editAdminNotif('${a.uid}', '${a.name}', '${a.notifications}')" title="設定推播通知"></i>`;
          
          if (a.level !== "超級管理員") {
            let toggleIcon = a.status === '已啟用' ? 'fa-ban text-warning' : 'fa-check-circle text-success';
            actionHtml += `
              <i class="fas ${toggleIcon} fa-lg mx-2" style="cursor:pointer;" onclick="manageAdminRole('${a.uid}', 'toggle')" title="切換狀態"></i>
              <i class="fas fa-trash-alt fa-lg text-danger mx-2" style="cursor:pointer;" onclick="manageAdminRole('${a.uid}', 'remove')" title="刪除權限"></i>
            `;
          } else {
            actionHtml += `<span class="text-muted ms-2" style="font-size:0.7rem;">(預設不可刪)</span>`;
          }

          tbody.innerHTML += `
            <tr>
              <td class="text-start fw-bold text-dark">
                ${a.name}<br>
                <span class="text-muted" style="font-size:0.7rem;"><i class="fas fa-bullhorn"></i> ${a.notifications || '無'}</span>
              </td>
              <td class="text-primary">${levelIcon} ${a.level}</td>
              <td><span class="badge bg-${bClass}">${a.status}</span></td>
              <td>${actionHtml}</td>
            </tr>`;
        });
        document.getElementById('admin-role-table').style.display = 'table';
      }
    });
}

function editAdminNotif(uid, name, currentNotifs) {
  let nArr = currentNotifs ? currentNotifs.split('、') : [];
  let c1 = nArr.includes('新用戶通知') ? 'checked' : '';
  let c2 = nArr.includes('財務驗證通知') ? 'checked' : '';
  let c3 = nArr.includes('代禱通知') ? 'checked' : '';
  let c4 = nArr.includes('活動報名通知') ? 'checked' : '';

  Swal.fire({
    title: `🔔 推播設定：${name}`,
    html: `
      <div class="text-start px-3 mt-3">
        <p class="text-muted mb-3" style="font-size: 0.85rem;">請勾選該同工需要接收的系統即時通知：</p>
        <div class="form-check mb-3"><input class="form-check-input edit-notif-chk shadow-sm" type="checkbox" value="新用戶通知" id="en1" ${c1}><label class="form-check-label fw-bold text-dark" for="en1">新用戶註冊</label></div>
        <div class="form-check mb-3"><input class="form-check-input edit-notif-chk shadow-sm" type="checkbox" value="財務驗證通知" id="en2" ${c2}><label class="form-check-label fw-bold text-dark" for="en2">財務開通申請</label></div>
        <div class="form-check mb-3"><input class="form-check-input edit-notif-chk shadow-sm" type="checkbox" value="代禱通知" id="en3" ${c3}><label class="form-check-label fw-bold text-dark" for="en3">新代禱事項</label></div>
        <div class="form-check mb-3"><input class="form-check-input edit-notif-chk shadow-sm" type="checkbox" value="活動報名通知" id="en4" ${c4}><label class="form-check-label fw-bold text-dark" for="en4">新活動報名</label></div>
      </div>
    `,
    showCancelButton: true, confirmButtonText: '儲存設定', cancelButtonText: '取消', confirmButtonColor: '#8e44ad',
    preConfirm: () => {
      let sel = [];
      document.querySelectorAll('.edit-notif-chk:checked').forEach(c => sel.push(c.value));
      return sel.length > 0 ? sel.join('、') : '無';
    }
  }).then(result => {
    if(result.isConfirmed) {
      Swal.fire({ title: '儲存中', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const gasUrl = window.CONFIG.GAS_URL;
      fetch(gasUrl, { 
        method: 'POST', 
        body: JSON.stringify({ 
          action: 'manageAdminRole', adminUid: currentUID, targetUid: uid, 
          targetName: '', roleLevel: '', notifications: result.value, manageAction: 'update_notif' 
        }) 
      }).then(res => res.json()).then(res => {
        if(res.success) Swal.fire('成功', res.message, 'success').then(() => loadAdminRoles());
        else Swal.fire('錯誤', res.message, 'error');
      }).catch(err => Swal.fire('連線錯誤', err.message, 'error'));
    }
  });
}

function assignAdminRole() {
  const selectEl = document.getElementById('role-user-select');
  const uid = selectEl.value;
  const nameText = selectEl.options[selectEl.selectedIndex].text.split(' (')[0]; 
  const level = document.getElementById('role-level-select').value;
  
  if (!uid) { Swal.fire('提醒', '請先從清單中選擇一位會友！', 'warning'); return; }
  
  let notifs = [];
  document.querySelectorAll('.role-notif-chk:checked').forEach(c => notifs.push(c.value));
  let notifStr = notifs.length > 0 ? notifs.join('、') : '無';

  Swal.fire({
    title: '指派確認', html: `確定要將 <b>${nameText}</b> 設為 <b class="text-danger">${level}</b> 嗎？<br><small class="text-muted">通知：${notifStr}</small>`, icon: 'question',
    showCancelButton: true, confirmButtonColor: '#c0392b', confirmButtonText: '確定指派'
  }).then(result => {
    if (result.isConfirmed) {
      Swal.fire({ title: '處理中', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const gasUrl = window.CONFIG.GAS_URL;
      fetch(gasUrl, { 
        method: 'POST', 
        body: JSON.stringify({ 
          action: 'manageAdminRole', adminUid: currentUID, targetUid: uid, targetName: nameText, 
          roleLevel: level, notifications: notifStr, manageAction: 'add' 
        }) 
      })
      .then(res => res.json()).then(res => {
        if (res.success) Swal.fire('成功', res.message, 'success').then(() => loadAdminRoles());
        else Swal.fire('失敗', res.message, 'error');
      }).catch(err => Swal.fire('錯誤', err.message, 'error'));
    }
  });
}

function manageAdminRole(targetUid, actionType) {
  let title = actionType === 'remove' ? '確定撤銷該同工的後台權限嗎？' : '確定要切換該同工的啟用狀態嗎？';
  Swal.fire({
    title: title, icon: 'warning', showCancelButton: true, confirmButtonColor: '#c0392b', confirmButtonText: '確定執行'
  }).then(result => {
    if (result.isConfirmed) {
      Swal.fire({ title: '處理中', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const gasUrl = window.CONFIG.GAS_URL;
      fetch(gasUrl, { method: 'POST', body: JSON.stringify({ action: 'manageAdminRole', adminUid: currentUID, targetUid: targetUid, targetName: '', roleLevel: '', notifications: '', manageAction: actionType }) })
        .then(res => res.json()).then(res => {
          if (res.success) Swal.fire('成功', res.message, 'success').then(() => loadAdminRoles());
          else Swal.fire('失敗', res.message, 'error');
        }).catch(err => Swal.fire('錯誤', err.message, 'error'));
    }
  });
}

// ==========================================
// 【回合 B】活動報表與 ERP 管理引擎 (Tab 2)
// ==========================================

function toggleEventView(viewType) {
  document.getElementById('btn-toggle-report').classList.remove('active');
  document.getElementById('btn-toggle-manage').classList.remove('active');
  document.getElementById('btn-toggle-create').classList.remove('active');
  document.getElementById('btn-toggle-archive').classList.remove('active');
  
  document.getElementById('event-report-view').style.display = 'none';
  document.getElementById('event-manage-view').style.display = 'none';
  document.getElementById('event-create-view').style.display = 'none';
  document.getElementById('event-archive-view').style.display = 'none';
  
  if(viewType === 'report') {
    document.getElementById('btn-toggle-report').classList.add('active');
    document.getElementById('event-report-view').style.display = 'block';
  } else if (viewType === 'manage') {
    document.getElementById('btn-toggle-manage').classList.add('active');
    document.getElementById('event-manage-view').style.display = 'block';
    loadManageEventList(); 
  } else if (viewType === 'archive') {
    document.getElementById('btn-toggle-archive').classList.add('active');
    document.getElementById('event-archive-view').style.display = 'block';
    loadArchiveEventList();
  } else {
    document.getElementById('btn-toggle-create').classList.add('active');
    document.getElementById('event-create-view').style.display = 'block';
  }
}

function loadAdminEventList() {
  const gasUrl = window.CONFIG.GAS_URL;
  fetch(`${gasUrl}?action=getAdminEventList&uid=${currentUID}`)
    .then(res => res.json())
    .then(res => {
      if (res.success && res.list.length > 0) {
        let sel = document.getElementById('report-event-select');
        sel.innerHTML = '<option value="">請選擇要檢視的活動報表...</option>'; 
        res.list.forEach(e => { 
          sel.innerHTML += `<option value="${e.id}">${e.start} - ${e.name} (${e.status}) [${e.currentRegs}/${e.capacity}]</option>`; 
        });
      }
    });
}

function parseExtraInfoToReadable(extraStr) {
  if (!extraStr || extraStr.trim() === '') return '';
  try {
    const obj = JSON.parse(extraStr);
    let readableArr = [];
    for (let key in obj) {
      if (obj[key] && String(obj[key]).trim() !== '') {
        readableArr.push(`${key}：${obj[key]}`);
      }
    }
    return readableArr.join(', ');
  } catch (e) {
    return extraStr;
  }
}

function loadEventReport() {
  let eventId = document.getElementById('report-event-select').value;
  if (!eventId) { Swal.fire('提醒', '請先選擇一個要檢視的活動報表！', 'warning'); return; }
  document.getElementById('print-section').style.display = 'none';
  Swal.fire({ title: '撈取名單中', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

  const gasUrl = window.CONFIG.GAS_URL;
  fetch(`${gasUrl}?action=getAdminEventRegistrations&uid=${currentUID}&eventId=${eventId}`)
    .then(res => res.json()).then(res => {
      if (res.success) {
        Swal.close();
        document.getElementById('print-section').style.display = 'block';
        document.getElementById('print-event-name').innerText = res.eventInfo.name;
        document.getElementById('print-event-time').innerText = `活動時間：${res.eventInfo.date} | 報名人數：${res.list.length} 人`;
        let tbody = document.getElementById('report-tbody');
        tbody.innerHTML = ''; 
        currentReportData = res.list;
        currentReportEventInfo = res.eventInfo; 
        
        if (res.list.length === 0) { 
          tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4 fw-bold">目前尚無人報名此活動</td></tr>'; 
        } else {
          res.list.forEach((reg, index) => {
            let attClass = reg.attendance === '已出席' ? 'text-success' : 'text-danger';
            
            let payBadge = reg.payStatus === '已繳費' ? '<span class="badge bg-success">已繳費</span>' : (reg.payStatus === '免繳費' ? '<span class="badge bg-secondary">免繳費</span>' : '<span class="badge bg-warning text-dark">未繳費</span>');
            let payBtnClass = reg.payStatus === '已繳費' ? 'btn-success' : 'btn-outline-warning text-dark';
            let payIcon = reg.payStatus === '已繳費' ? 'fa-check-circle' : 'fa-dollar-sign';

            let attBtnClass = reg.attendance === '已出席' ? 'btn-success' : 'btn-outline-secondary';
            let attIcon = reg.attendance === '已出席' ? 'fa-user-check' : 'fa-user-times';

            let readableExtra = parseExtraInfoToReadable(reg.extraInfo);

            tbody.innerHTML += `<tr>
              <td class="text-center fw-bold">${index + 1}</td>
              <td class="fw-bold text-primary">${reg.participantName}</td>
              <td class="text-center text-muted">${reg.type}</td>
              <td class="text-center">${reg.phone}</td>
              <td class="text-center">${payBadge}</td>
              <td class="text-center fw-bold ${attClass} print-blank-cell"><span class="no-print">${reg.attendance}</span></td>
              <td class="text-muted" style="font-size:0.85rem; max-width:250px;">${readableExtra}</td>
              <td class="text-center no-print">
                <button class="btn btn-sm ${attBtnClass} mb-1" onclick="toggleAttendance('${reg.regId}', '${reg.attendance}')" title="切換出席/簽到狀態"><i class="fas ${attIcon}"></i></button>
                <button class="btn btn-sm ${payBtnClass} mb-1" onclick="togglePayment('${reg.regId}', ${index})" title="切換繳費狀態"><i class="fas ${payIcon}"></i></button>
                <button class="btn btn-sm btn-outline-primary mb-1" onclick='openEditRegModal(${index})' title="編輯資料"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-outline-danger mb-1" onclick="deleteReg('${reg.regId}')" title="刪除報名"><i class="fas fa-trash-alt"></i></button>
              </td>
            </tr>`;
          });
        }
      } else { Swal.fire('錯誤', res.message, 'error'); }
    }).catch(err => Swal.fire('連線錯誤', err.message, 'error'));
}

function toggleAttendance(regId, currentStatus) {
  let actionText = currentStatus === '已出席' ? '取消簽到 (改回未出席)' : '手動簽到 (改為已出席)';
  
  Swal.fire({ 
    title: '切換出席狀態', 
    text: `確定要將該名會友標記為「${actionText}」嗎？`, 
    icon: 'question',
    showCancelButton: true, confirmButtonColor: '#28a745', confirmButtonText: '確定切換'
  }).then((result) => {
    if (result.isConfirmed) {
      Swal.fire({ title: '更新中...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const gasUrl = window.CONFIG.GAS_URL;
      fetch(gasUrl, { method: 'POST', body: JSON.stringify({ action: 'adminToggleAttendance', adminUid: currentUID, regId: regId }) })
        .then(res => res.json()).then(res => {
          if(res.success) { 
            Swal.fire({title: '成功', text: res.message, icon: 'success', timer: 1500, showConfirmButton: false}); 
            loadEventReport(); 
          }
          else Swal.fire('錯誤', res.message, 'error');
        }).catch(err => Swal.fire('連線錯誤', err.message, 'error'));
    }
  });
}

function togglePayment(regId, index) {
  Swal.fire({ title: '更新繳費狀態中...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  const gasUrl = window.CONFIG.GAS_URL;
  fetch(gasUrl, { method: 'POST', body: JSON.stringify({ action: 'adminTogglePayment', adminUid: currentUID, regId: regId }) })
    .then(res => res.json()).then(res => {
      if(res.success) { 
        Swal.fire({title: '成功', text: res.message, icon: 'success', timer: 1500, showConfirmButton: false}); 
        loadEventReport();
      }
      else Swal.fire('錯誤', res.message, 'error');
    }).catch(err => Swal.fire('連線錯誤', err.message, 'error'));
}

function openAddRegModal() {
  let eventId = document.getElementById('report-event-select').value;
  if (!eventId) { Swal.fire('提醒', '請先選擇一個活動！', 'warning'); return; }
  
  let customFormStr = currentReportEventInfo ? currentReportEventInfo.extraQ : "";
  let htmlFields = `
      <div class="text-start mt-2">
        <label class="form-label fw-bold text-dark">參與者姓名 <span class="text-danger">*</span></label>
        <input type="text" id="ar-name" class="form-control mb-3" placeholder="請輸入參與者姓名">
        
        <label class="form-label fw-bold text-dark">聯絡電話</label>
        <input type="tel" id="ar-phone" class="form-control mb-3" placeholder="選填">
        
        <label class="form-label fw-bold text-dark">繳費狀態</label>
        <select id="ar-pay" class="form-select border-primary mb-3">
          <option value="未繳費">未繳費</option>
          <option value="已繳費">已繳費 (現場收現)</option>
          <option value="免繳費">免繳費</option>
        </select>
        
        <hr>
        <h6 class="fw-bold text-muted mb-2"><i class="fas fa-list"></i> 報名選項 / 個資</h6>
  `;

  if (customFormStr && customFormStr.trim() !== '') {
      const forms = customFormStr.split('|');
      forms.forEach((f) => {
          if (f.includes(':')) {
              const parts = f.split(':');
              if(parts.length === 2) {
                  const qName = parts[0].trim();
                  const opts = parts[1].split(',').map(o => o.trim());
                  
                  htmlFields += `
                    <div class="mb-3">
                      <label class="form-label text-dark fw-bold" style="font-size:0.9rem;">${qName}</label>
                      <select class="form-select border-primary admin-dynamic-select-add" data-qname="${qName}">
                        <option value="" disabled selected>請選擇...</option>`;
                  opts.forEach(o => { 
                      htmlFields += `<option value="${o}">${o}</option>`; 
                  });
                  htmlFields += `</select></div>`;
              }
          } else if (f.includes('-')) {
              const parts = f.split('-');
              if(parts.length === 2) {
                  const qName = parts[0].trim();
                  const opts = parts[1].split(',').map(o => o.trim());
                  
                  htmlFields += `
                    <div class="mb-3">
                      <label class="form-label text-dark fw-bold" style="font-size:0.9rem;">${qName}</label>
                      <div class="bg-light p-2 rounded border">
                        <div class="row g-2">`;
                  opts.forEach((o, idx) => {
                      const cId = `admin-chk-add-${qName}-${idx}`;
                      htmlFields += `
                        <div class="col-6">
                          <div class="form-check">
                            <input class="form-check-input admin-dynamic-checkbox-add" type="checkbox" value="${o}" id="${cId}" data-qname="${qName}">
                            <label class="form-check-label text-muted" for="${cId}">${o}</label>
                          </div>
                        </div>`;
                  });
                  htmlFields += `</div></div></div>`;
              }
          }
      });
  }

  htmlFields += `
        <div class="mb-3">
          <label class="form-label fw-bold text-dark" style="font-size:0.9rem;">身分證字號</label>
          <input type="text" class="form-control admin-dynamic-input-add" data-qname="身分證" placeholder="若保險需要請填寫">
        </div>
        <div class="mb-3">
          <label class="form-label fw-bold text-dark" style="font-size:0.9rem;">生日</label>
          <input type="date" class="form-control admin-dynamic-input-add" data-qname="生日">
        </div>
        <div class="mb-3">
          <label class="form-label fw-bold text-dark" style="font-size:0.9rem;">自訂備註</label>
          <input type="text" class="form-control admin-dynamic-input-add" data-qname="備註" placeholder="其他備註資訊">
        </div>
      </div>
  `;

  Swal.fire({
    title: '新增報名者 (後台代報)',
    html: htmlFields,
    showCancelButton: true, confirmButtonText: '確定新增', cancelButtonText: '取消', confirmButtonColor: '#2ecc71',
    preConfirm: () => {
      let name = document.getElementById('ar-name').value.trim();
      if(!name) { Swal.showValidationMessage('請務必填寫姓名！'); return false; }
      
      let finalExtraObj = {};
      document.querySelectorAll('.admin-dynamic-select-add').forEach(el => {
          if(el.value) finalExtraObj[el.getAttribute('data-qname')] = el.value;
      });
      
      let checkMap = {};
      document.querySelectorAll('.admin-dynamic-checkbox-add:checked').forEach(el => {
          const qName = el.getAttribute('data-qname');
          if (!checkMap[qName]) checkMap[qName] = [];
          checkMap[qName].push(el.value);
      });
      for (let q in checkMap) { finalExtraObj[q] = checkMap[q].join(', '); }

      document.querySelectorAll('.admin-dynamic-input-add').forEach(el => {
          if(el.value.trim()) finalExtraObj[el.getAttribute('data-qname')] = el.value.trim();
      });

      let finalExtraStr = Object.keys(finalExtraObj).length === 0 ? "" : JSON.stringify(finalExtraObj);

      return {
        name: name, 
        phone: document.getElementById('ar-phone').value.trim(),
        payStatus: document.getElementById('ar-pay').value,
        extra: finalExtraStr
      }
    }
  }).then(res => {
    if(res.isConfirmed) {
      Swal.fire({ title: '寫入資料庫中', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      let v = res.value;
      const gasUrl = window.CONFIG.GAS_URL;
      fetch(gasUrl, { 
        method: 'POST', 
        body: JSON.stringify({ action: 'adminAddReg', adminUid: currentUID, eventId: eventId, name: v.name, phone: v.phone, extra: v.extra, payStatus: v.payStatus }) 
      }).then(res => res.json()).then(res => {
          if(res.success) Swal.fire('新增成功', res.message, 'success').then(()=>loadEventReport());
          else Swal.fire('錯誤', res.message, 'error');
      }).catch(err => Swal.fire('連線錯誤', err.message, 'error'));
    }
  });
}

function openEditRegModal(index) {
  let reg = currentReportData[index];
  let customFormStr = currentReportEventInfo ? currentReportEventInfo.extraQ : "";
  
  let existingAnswers = {};
  try {
      existingAnswers = JSON.parse(reg.extraInfo || "{}");
  } catch (e) {
      existingAnswers = { "備註": reg.extraInfo };
  }

  let htmlFields = `
      <div class="text-start mt-2">
        <label class="form-label fw-bold text-dark">參與者姓名</label>
        <input type="text" id="er-name" class="form-control mb-3" value="${reg.participantName}">
        <label class="form-label fw-bold text-dark">聯絡電話</label>
        <input type="text" id="er-phone" class="form-control mb-3" value="${reg.phone}">
        <hr>
        <h6 class="fw-bold text-muted mb-2"><i class="fas fa-list"></i> 報名選項 / 個資</h6>
  `;

  if (customFormStr && customFormStr.trim() !== '') {
      const forms = customFormStr.split('|');
      forms.forEach((f) => {
          if (f.includes(':')) {
              const parts = f.split(':');
              if(parts.length === 2) {
                  const qName = parts[0].trim();
                  const opts = parts[1].split(',').map(o => o.trim());
                  const currentAns = existingAnswers[qName] || "";
                  
                  htmlFields += `
                    <div class="mb-3">
                      <label class="form-label text-dark fw-bold" style="font-size:0.9rem;">${qName}</label>
                      <select class="form-select border-primary admin-dynamic-select" data-qname="${qName}">
                        <option value="" disabled ${!currentAns ? 'selected' : ''}>請選擇...</option>`;
                  opts.forEach(o => { 
                      let sel = (o === currentAns) ? 'selected' : '';
                      htmlFields += `<option value="${o}" ${sel}>${o}</option>`; 
                  });
                  htmlFields += `</select></div>`;
              }
          } else if (f.includes('-')) {
              const parts = f.split('-');
              if(parts.length === 2) {
                  const qName = parts[0].trim();
                  const opts = parts[1].split(',').map(o => o.trim());
                  const currentAnsArr = (existingAnswers[qName] || "").split(',').map(x=>x.trim());
                  
                  htmlFields += `
                    <div class="mb-3">
                      <label class="form-label text-dark fw-bold" style="font-size:0.9rem;">${qName}</label>
                      <div class="bg-light p-2 rounded border">
                        <div class="row g-2">`;
                  opts.forEach((o, idx) => {
                      const cId = `admin-chk-${qName}-${idx}`;
                      let chk = currentAnsArr.includes(o) ? 'checked' : '';
                      htmlFields += `
                        <div class="col-6">
                          <div class="form-check">
                            <input class="form-check-input admin-dynamic-checkbox" type="checkbox" value="${o}" id="${cId}" data-qname="${qName}" ${chk}>
                            <label class="form-check-label text-muted" for="${cId}">${o}</label>
                          </div>
                        </div>`;
                  });
                  htmlFields += `</div></div></div>`;
              }
          }
      });
  }

  if (existingAnswers['身分證']) {
      htmlFields += `
        <div class="mb-3">
          <label class="form-label fw-bold text-dark" style="font-size:0.9rem;">身分證字號</label>
          <input type="text" class="form-control admin-dynamic-input" data-qname="身分證" value="${existingAnswers['身分證']}">
        </div>`;
  }
  if (existingAnswers['生日']) {
      htmlFields += `
        <div class="mb-3">
          <label class="form-label fw-bold text-dark" style="font-size:0.9rem;">生日</label>
          <input type="date" class="form-control admin-dynamic-input" data-qname="生日" value="${existingAnswers['生日']}">
        </div>`;
  }

  let memoText = existingAnswers['備註'] || "";
  htmlFields += `
        <div class="mb-3">
          <label class="form-label fw-bold text-dark" style="font-size:0.9rem;">自訂備註</label>
          <input type="text" class="form-control admin-dynamic-input" data-qname="備註" value="${memoText}" placeholder="若無特殊選項，可直接填寫於此">
        </div>
      </div>
  `;

  Swal.fire({
    title: '編輯報名資料',
    html: htmlFields,
    showCancelButton: true, confirmButtonText: '儲存修改', cancelButtonText: '取消', confirmButtonColor: '#3498db'
  }).then(res => {
    if(res.isConfirmed) {
      
      let finalExtraObj = {};
      
      document.querySelectorAll('.admin-dynamic-select').forEach(el => {
          if(el.value) finalExtraObj[el.getAttribute('data-qname')] = el.value;
      });
      
      let checkMap = {};
      document.querySelectorAll('.admin-dynamic-checkbox:checked').forEach(el => {
          const qName = el.getAttribute('data-qname');
          if (!checkMap[qName]) checkMap[qName] = [];
          checkMap[qName].push(el.value);
      });
      for (let q in checkMap) { finalExtraObj[q] = checkMap[q].join(', '); }

      document.querySelectorAll('.admin-dynamic-input').forEach(el => {
          if(el.value.trim()) finalExtraObj[el.getAttribute('data-qname')] = el.value.trim();
      });

      let finalExtraStr = Object.keys(finalExtraObj).length === 0 ? "" : JSON.stringify(finalExtraObj);

      Swal.fire({ title: '儲存中', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const gasUrl = window.CONFIG.GAS_URL;
      fetch(gasUrl, { 
        method: 'POST', 
        body: JSON.stringify({ 
            action: 'adminUpdateReg', 
            adminUid: currentUID, 
            regId: reg.regId, 
            name: document.getElementById('er-name').value.trim(), 
            phone: document.getElementById('er-phone').value.trim(), 
            extra: finalExtraStr 
        }) 
      }).then(res => res.json()).then(res => {
          if(res.success) Swal.fire('成功', res.message, 'success').then(()=>loadEventReport());
          else Swal.fire('錯誤', res.message, 'error');
      }).catch(err => Swal.fire('連線錯誤', err.message, 'error'));
    }
  });
}

function deleteReg(regId) {
  Swal.fire({
    title: '確認強制刪除？', 
    text: '刪除後將無法恢復，且會立即釋出報名名額！', 
    icon: 'warning',
    showCancelButton: true, confirmButtonColor: '#e74c3c', confirmButtonText: '是的，強制刪除！'
  }).then((result) => {
    if (result.isConfirmed) {
      Swal.fire({ title: '刪除中', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const gasUrl = window.CONFIG.GAS_URL;
      fetch(gasUrl, { method: 'POST', body: JSON.stringify({ action: 'adminDeleteReg', adminUid: currentUID, regId: regId }) })
        .then(res => res.json()).then(res => {
          if(res.success) Swal.fire('已刪除', res.message, 'success').then(()=>loadEventReport());
          else Swal.fire('錯誤', res.message, 'error');
        }).catch(err => Swal.fire('連線錯誤', err.message, 'error'));
    }
  });
}

function downloadCSV() {
  if (currentReportData.length === 0) { Swal.fire('提醒', '目前沒有資料可以匯出喔！', 'warning'); return; }
  let eventName = document.getElementById('print-event-name').innerText;
  let csvContent = '\uFEFF'; csvContent += "序號,報名時間,報名類型,姓名,聯絡電話,繳費狀態,出席狀態,自訂備註\n";
  currentReportData.forEach((row, index) => {
    let readableExtra = parseExtraInfoToReadable(row.extraInfo);
    let extra = String(readableExtra || '').replace(/"/g, '""'); 
    csvContent += `${index+1},${row.regTime},${row.type},${row.participantName},${row.phone},${row.payStatus},${row.attendance},"${extra}"\n`;
  });
  let blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  let link = document.createElement("a");
  link.setAttribute("href", URL.createObjectURL(blob));
  link.setAttribute("download", `霧峰教會_${eventName}_報名名單.csv`);
  link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

function loadBroadcastForm() {
  if (!adminData) return;
  const optGroups = document.getElementById('optgroup-groups');
  if (optGroups && adminData.availableGroups) adminData.availableGroups.forEach(g => optGroups.innerHTML += `<option value="Group:${g}">${g}</option>`);
  const optServices = document.getElementById('optgroup-services');
  if (optServices && adminData.availableServices) adminData.availableServices.forEach(s => optServices.innerHTML += `<option value="Service:${s}">${s}</option>`);
  
  const optEvents = document.getElementById('optgroup-events');
  const eventSelect = document.getElementById('broadcast-event'); 
  
  let groupEventMap = {};

  if (adminData.allAdminEvents && adminData.allAdminEvents.length > 0) {
    adminData.allAdminEvents.forEach(e => {
      if (optEvents) optEvents.innerHTML += `<option value="Event:${e.id}">${e.name} (單一場次報名者)</option>`;
      if (eventSelect) eventSelect.innerHTML += `<option value="${e.id}">🎟️ [${e.category}] ${e.name}</option>`;
      
      if (e.groupId) {
         let cleanName = e.name.replace(/\([一二三四五六七八九十1-9]+\)$/, "").trim();
         groupEventMap[e.groupId] = cleanName;
      }
    });
    
    for (let gId in groupEventMap) {
        if (optEvents) optEvents.innerHTML += `<option value="GroupEvent:${gId}">📂 ${groupEventMap[gId]} (整個系列報名者)</option>`;
    }
    
  } else if (adminData.activeEvents) {
     adminData.activeEvents.forEach(e => {
      if (optEvents) optEvents.innerHTML += `<option value="Event:${e.id}">${e.name} (單一場次報名者)</option>`;
      if (eventSelect) eventSelect.innerHTML += `<option value="${e.id}">🎟️ [${e.category}] ${e.name}</option>`;
    });
  }
}

function submitBroadcast() {
  const target = document.getElementById('broadcast-target').value;
  const msg = document.getElementById('broadcast-msg').value.trim();
  const eventId = document.getElementById('broadcast-event').value;
  if (!msg) { Swal.fire('提醒', '推播內容不能為空喔！', 'warning'); return; }

  let displayTarget = target;
  if (target.startsWith("Group:")) displayTarget = "團契：" + target.replace("Group:", "");
  else if (target.startsWith("Service:")) displayTarget = "服事單位：" + target.replace("Service:", "");
  else if (target.startsWith("GroupEvent:")) displayTarget = "系列活動全體報名者"; 
  else if (target.startsWith("Event:")) displayTarget = "活動報名者 (" + target.replace("Event:", "") + ")";
  else if (target.startsWith("Tier ")) displayTarget = "帳號等級：" + target;

  Swal.fire({ title: '發送確認', html: `您即將對 <b class="text-danger">${displayTarget}</b> 發送推播。<br>確定要發送嗎？`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#8e44ad', confirmButtonText: '確定發送'
  }).then((result) => {
    if (result.isConfirmed) {
      const btn = document.getElementById('btn-send-broadcast'); const originalHtml = btn.innerHTML;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 系統處理中...'; btn.disabled = true;
      const gasUrl = window.CONFIG.GAS_URL;
      fetch(gasUrl, { method: 'POST', body: JSON.stringify({ action: 'sendBroadcast', uid: currentUID, targetGroup: target, messageContent: msg, attachEventId: eventId }) })
      .then(res => res.json()).then(res => {
        btn.innerHTML = originalHtml; btn.disabled = false;
        if (res.success) { Swal.fire('發送成功！', res.message, 'success'); document.getElementById('broadcast-msg').value = ''; document.getElementById('broadcast-event').value = '無'; } 
        else Swal.fire('發送失敗', res.message, 'error');
      }).catch(err => { btn.innerHTML = originalHtml; btn.disabled = false; Swal.fire('連線錯誤', err.message, 'error'); });
    }
  });
}

function loadSystemSettings() {
  const gasUrl = window.CONFIG.GAS_URL;
  fetch(`${gasUrl}?action=getSystemSettings&uid=${currentUID}`)
    .then(res => res.json()).then(res => {
      document.getElementById('settings-loading').style.display = 'none';
      if (res.success) {
        document.getElementById('settings-content').style.display = 'block'; const s = res.settings;
        document.getElementById('set-toggle-birthday').checked = (String(s["自動_生日祝福_開關"]).toUpperCase() === "TRUE"); document.getElementById('set-tpl-birthday').value = s["自動_生日祝福_模板"] || "";
        document.getElementById('set-toggle-event7').checked = (String(s["自動_活動提醒7天_開關"]).toUpperCase() === "TRUE"); document.getElementById('set-tpl-event7').value = s["自動_活動提醒7天_模板"] || "";
        document.getElementById('set-toggle-event3').checked = (String(s["自動_活動提醒3天_開關"]).toUpperCase() === "TRUE"); document.getElementById('set-tpl-event3').value = s["自動_活動提醒3天_模板"] || "";
        document.getElementById('set-toggle-event1').checked = (String(s["自動_活動提醒1天_開關"]).toUpperCase() === "TRUE"); document.getElementById('set-tpl-event1').value = s["自動_活動提醒1天_模板"] || "";
        document.getElementById('set-toggle-feedback').checked = (String(s["自動_活動回饋_開關"]).toUpperCase() === "TRUE"); document.getElementById('set-tpl-feedback').value = s["自動_活動回饋_模板"] || "";
      } else { document.getElementById('settings-loading').innerHTML = `<div class="alert alert-danger">${res.message}</div>`; }
    }).catch(err => { document.getElementById('settings-loading').innerHTML = `<div class="alert alert-danger">連線失敗：${err.message}</div>`; });
}

function saveSystemSettings() {
  const btn = document.getElementById('btn-save-settings'); const originalHtml = btn.innerHTML;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 儲存中...'; btn.disabled = true;
  const settingsObj = {
    "自動_生日祝福_開關": document.getElementById('set-toggle-birthday').checked ? "TRUE" : "FALSE", "自動_生日祝福_模板": document.getElementById('set-tpl-birthday').value.trim(),
    "自動_活動提醒7天_開關": document.getElementById('set-toggle-event7').checked ? "TRUE" : "FALSE", "自動_活動提醒7天_模板": document.getElementById('set-tpl-event7').value.trim(),
    "自動_活動提醒3天_開關": document.getElementById('set-toggle-event3').checked ? "TRUE" : "FALSE", "自動_活動提醒3天_模板": document.getElementById('set-tpl-event3').value.trim(),
    "自動_活動提醒1天_開關": document.getElementById('set-toggle-event1').checked ? "TRUE" : "FALSE", "自動_活動提醒1天_模板": document.getElementById('set-tpl-event1').value.trim(),
    "自動_活動回饋_開關": document.getElementById('set-toggle-feedback').checked ? "TRUE" : "FALSE", "自動_活動回饋_模板": document.getElementById('set-tpl-feedback').value.trim()
  };
  const gasUrl = window.CONFIG.GAS_URL;
  fetch(gasUrl, { method: 'POST', body: JSON.stringify({ action: 'saveSystemSettings', uid: currentUID, settings: settingsObj }) })
  .then(res => res.json()).then(res => {
    btn.innerHTML = originalHtml; btn.disabled = false;
    if (res.success) Swal.fire({ title: '儲存成功', text: '排程設定已更新！', icon: 'success', timer: 2000, showConfirmButton: false });
    else Swal.fire('儲存失敗', res.message, 'error');
  }).catch(err => { btn.innerHTML = originalHtml; btn.disabled = false; Swal.fire('連線錯誤', err.message, 'error'); });
}

document.addEventListener('DOMContentLoaded', function() {
  setTimeout(() => { 
    const feeNameSelect = document.getElementById('ec-feeName');
    if (feeNameSelect) {
      feeNameSelect.addEventListener('change', function() {
        const amtBox = document.getElementById('fee-amount-box');
        if (this.value === "無") {
          amtBox.style.display = 'none';
          document.getElementById('ec-feeAmount').value = '';
        } else {
          amtBox.style.display = 'block';
        }
      });
    }
  }, 1000);
});

function populateCategoryDropdown() {
  const catSelect = document.getElementById('ec-category');
  if (!catSelect || !adminData || !adminData.categoryConfig) return;
  catSelect.innerHTML = '<option value="">請選擇...</option>';
  for (let catName in adminData.categoryConfig) {
    catSelect.innerHTML += `<option value="${catName}">${catName}</option>`;
  }
}

const originalLoadAdminEventList = loadAdminEventList;
loadAdminEventList = function() {
  originalLoadAdminEventList();
  setTimeout(populateCategoryDropdown, 1500); 
}

function generateGroupId() {
  const dateStr = new Date().toISOString().slice(2,7).replace('-', ''); 
  const randomStr = Math.floor(1000 + Math.random() * 9000); 
  document.getElementById('ec-group-id').value = "G" + dateStr + "-" + randomStr;
}

function submitNewEvent() {
  const name = document.getElementById('ec-name').value.trim();
  const category = document.getElementById('ec-category').value;
  const start = document.getElementById('ec-start').value;
  const end = document.getElementById('ec-end').value;
  const posterBase64 = document.getElementById('ec-poster-base64').value; // 抓取隱藏欄位

  if (!name || !category || !start || !end) {
    Swal.fire('提醒', '請填寫所有帶有紅色 * 號的必填欄位！', 'warning');
    return;
  }

  // 【除錯檢查】如果選了檔案但 Base64 是空的，提示使用者
  const fileInput = document.getElementById('ec-poster-file');
  if (fileInput.files.length > 0 && (!posterBase64 || posterBase64.length < 100)) {
    Swal.fire('圖片處理中', '圖片還在壓縮解析中，請等候預覽圖出現後再點擊上架！', 'info');
    return;
  }

  const formatTime = (t) => t ? t.replace('T', ' ').replace(/-/g, '/') : "";

  const payload = {
    name: name,
    groupId: document.getElementById('ec-group-id').value.trim(), 
    category: category,
    capacity: document.getElementById('ec-cap').value,
    start: formatTime(start),
    end: formatTime(end),
    regEnd: formatTime(document.getElementById('ec-regEnd').value),
    feeName: document.getElementById('ec-feeName').value,
    feeAmount: document.getElementById('ec-feeAmount').value || "",
    customOpt: document.getElementById('ec-custom').value.trim(),
    posterBase64: posterBase64, // 確保這行有值
    desc: document.getElementById('ec-desc').value.trim(),
    proxy: document.getElementById('ec-proxy').checked,
    extra: document.getElementById('ec-extra').checked
  };

  console.log("準備送出的 Payload:", payload); // 您可以開啟瀏覽器 F12 檢查這行

  Swal.fire({
    title: '即將上架活動',
    text: `確定要建立「${name}」嗎？`,
    icon: 'question',
    showCancelButton: true, confirmButtonColor: '#2ecc71', confirmButtonText: '確定上架'
  }).then(result => {
    if (result.isConfirmed) {
      Swal.fire({ title: '系統處理中...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const gasUrl = window.CONFIG.GAS_URL;
      fetch(gasUrl, { method: 'POST', body: JSON.stringify({ action: 'adminCreateEvent', adminUid: currentUID, eventData: payload }) })
      .then(res => res.json()).then(res => {
        if (res.success) {
          // 修改這裡：顯示後端回傳的完整 message (包含圖片狀態)
          Swal.fire({ title: '上架結果', text: res.message, icon: 'success' }).then(() => {
            document.getElementById('create-event-form').reset();
            document.getElementById('poster-preview').style.display = 'none';
            document.getElementById('ec-poster-base64').value = '';
            toggleEventView('report'); 
            loadAdminEventList(); 
          });
        } else {
          Swal.fire('錯誤', res.message, 'error');
        }
      }).catch(err => Swal.fire('連線錯誤', err.message, 'error'));
    }
  });
}


// 【新增】圖片壓縮與預覽引擎 (將圖片轉為 Base64)
function compressImage(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      const MAX_WIDTH = 800; // 壓縮寬度限制在 800px 以內，節省傳輸時間與儲存空間

      if (width > MAX_WIDTH) {
        height *= MAX_WIDTH / width;
        width = MAX_WIDTH;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // 轉換為 70% 畫質的 JPEG Base64
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7); 
      document.getElementById('ec-poster-base64').value = dataUrl;

      // 顯示預覽畫面
      const previewContainer = document.getElementById('poster-preview');
      const previewImg = document.getElementById('poster-preview-img');
      previewImg.src = dataUrl;
      previewContainer.style.display = 'block';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function loadManageEventList() {
  document.getElementById('manage-event-loading').style.display = 'block';
  document.getElementById('manage-event-list').style.display = 'none';
  
  const gasUrl = window.CONFIG.GAS_URL;
  fetch(`${gasUrl}?action=getAdminEventList&uid=${currentUID}`)
    .then(res => res.json())
    .then(res => {
      document.getElementById('manage-event-loading').style.display = 'none';
      if (res.success) {
        currentManageEventList = res.list;
        renderManageEventList(res.list);
      } else {
        document.getElementById('manage-event-list').innerHTML = `<div class="alert alert-danger">${res.message}</div>`;
        document.getElementById('manage-event-list').style.display = 'block';
      }
    }).catch(err => {
      document.getElementById('manage-event-loading').style.display = 'none';
      document.getElementById('manage-event-list').innerHTML = `<div class="alert alert-danger">連線失敗</div>`;
      document.getElementById('manage-event-list').style.display = 'block';
    });
}

function renderManageEventList(list) {
  const container = document.getElementById('manage-event-list');
  container.innerHTML = '';

  if (list.length === 0) {
    container.innerHTML = '<div class="text-center text-muted py-4">目前沒有任何活動紀錄</div>';
  } else {
    list.forEach((evt, index) => {
      let bClass = evt.status === '開放報名' ? 'success' : (evt.status === '已封存' ? 'secondary' : 'primary');
      
      container.innerHTML += `
        <div class="list-group-item p-3 border-bottom border-0">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <h6 class="fw-bold text-dark mb-0">${evt.name}</h6>
            <span class="badge bg-${bClass} ms-1" style="font-size:0.75rem;">${evt.status}</span>
          </div>
          <div class="text-muted mb-2" style="font-size:0.85rem;">
            <i class="far fa-calendar-alt w-20px"></i> ${evt.start} <br>
            <i class="fas fa-users w-20px"></i> 已報名：<strong class="text-primary">${evt.currentRegs}</strong> / ${evt.capacity} <br>
            <i class="fas fa-hashtag w-20px"></i> ID: <span style="font-family:monospace;">${evt.id}</span> | 群組: <span style="font-family:monospace;">${evt.groupId || '無'}</span>
          </div>
          <div class="text-end mt-2">
            <button class="btn btn-sm btn-outline-primary rounded-pill px-3 shadow-sm me-1" onclick="openEditEventModal('${evt.id}')"><i class="fas fa-edit"></i> 編輯設定</button>
            <button class="btn btn-sm btn-outline-danger rounded-pill px-3 shadow-sm" onclick="deleteEvent('${evt.id}', '${evt.name}')"><i class="fas fa-trash-alt"></i></button>
          </div>
        </div>
      `;
    });
  }
  container.style.display = 'block';
}

// ========== 👇 從這裡開始替換 openEditEventModal 👇 ==========
function openEditEventModal(eventId) {
    Swal.fire({ title: '撈取活動資料中...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    
    const gasUrl = window.CONFIG.GAS_URL;
    fetch(`${gasUrl}?action=getUser&uid=${currentUID}`)
        .then(res => res.json()).then(res => {
            Swal.close();
            let evtDetail = res.activeEvents.find(e => e.id === eventId);
            
            if (!evtDetail) {
                evtDetail = res.allAdminEvents.find(e => e.id === eventId);
                if (!evtDetail) {
                    Swal.fire('錯誤', '找不到此活動的詳細資料，可能已被封存。', 'error');
                    return;
                }
                evtDetail.allowProxy = false; evtDetail.requireExtraInfo = false; evtDetail.capacity = "";
                evtDetail.posterUrl = ""; evtDetail.description = ""; evtDetail.feeName = "無"; evtDetail.feeAmount = ""; evtDetail.customForm = "";
            }

            let catOptions = '';
            for (let catName in res.categoryConfig) {
                let sel = (catName === evtDetail.category) ? 'selected' : '';
                catOptions += `<option value="${catName}" ${sel}>${catName}</option>`;
            }
            
            let dateStartStr = evtDetail.startRaw || "";
            let dateEndStr   = evtDetail.endRaw || dateStartStr;
            let regEndStr    = evtDetail.regEndRaw || "";
            let proxyChecked = evtDetail.allowProxy ? "checked" : "";
            let extraChecked = evtDetail.requireExtraInfo ? "checked" : "";
            
            // 【關鍵】初始判斷收費欄位是否顯示
            let feeBoxDisplay = (evtDetail.feeName === "無" || !evtDetail.feeName) ? "none" : "block";

            Swal.fire({
                title: '編輯活動設定',
                width: '650px',
                html: `
                    <div class="text-start mt-2" style="font-size:0.9rem;">
                        <div class="alert alert-warning p-2" style="font-size:0.85rem;"><i class="fas fa-exclamation-triangle"></i> 提示：若需提早結束報名，請將狀態改為「已結束」。</div>
                        
                        <div class="row g-3 mb-3">
                            <div class="col-8">
                                <label class="form-label fw-bold text-dark">活動名稱 <span class="text-danger">*</span></label>
                                <input type="text" id="ee-name" class="form-control border-primary" value="${evtDetail.name}">
                            </div>
                            <div class="col-4">
                                <label class="form-label fw-bold text-dark">狀態</label>
                                <select id="ee-status" class="form-select border-primary">
                                    <option value="開放報名">開放報名</option>
                                    <option value="進行中">進行中</option>
                                    <option value="已結束">已結束</option>
                                </select>
                            </div>

                            <div class="col-md-6">
                                <label class="form-label fw-bold text-dark">群組編號 (Group ID)</label>
                                <input type="text" id="ee-groupId" class="form-control" list="existing-group-ids" value="${evtDetail.groupId || ''}" placeholder="修改此編號可建立系列關聯">
                            </div>
                            <div class="col-md-6">
                                <label class="form-label fw-bold text-dark">活動分類 <span class="text-danger">*</span></label>
                                <select id="ee-category" class="form-select border-primary">${catOptions}</select>
                            </div>
                            
                            <div class="col-12 mt-2">
                              <h6 class="fw-bold text-muted border-bottom pb-2"><i class="fas fa-calendar-alt"></i> 時間與報名限制</h6>
                            </div>

                            <div class="col-6">
                                <label class="form-label fw-bold text-dark">開始時間 <span class="text-danger">*</span></label>
                                <input type="datetime-local" id="ee-start" class="form-control border-primary" value="${dateStartStr}">
                            </div>
                            <div class="col-6">
                                <label class="form-label fw-bold text-dark">結束時間 <span class="text-danger">*</span></label>
                                <input type="datetime-local" id="ee-end" class="form-control border-primary" value="${dateEndStr}">
                            </div>

                            <div class="col-6">
                                <label class="form-label fw-bold text-dark">人數上限</label>
                                <input type="number" id="ee-cap" class="form-control" value="${evtDetail.remainingSpots || ''}">
                            </div>
                            <div class="col-6">
                                <label class="form-label fw-bold text-dark">報名截止時間</label>
                                <input type="datetime-local" id="ee-regEnd" class="form-control" value="${regEndStr}">
                            </div>

                            <div class="col-12 mt-2">
                              <h6 class="fw-bold text-muted border-bottom pb-2"><i class="fas fa-cogs"></i> 收費與附加設定</h6>
                            </div>

                            <div class="col-6">
                                <label class="form-label fw-bold text-dark">收費名目</label>
                                <select id="ee-feeName" class="form-select" onchange="document.getElementById('ee-fee-amount-box').style.display = (this.value === '無' ? 'none' : 'block'); if(this.value === '無') document.getElementById('ee-feeAmount').value = '';">
                                    <option value="無" ${evtDetail.feeName === '無' ? 'selected' : ''}>免費活動</option>
                                    <option value="活動代辦費" ${evtDetail.feeName === '活動代辦費' ? 'selected' : ''}>活動代辦費</option>
                                    <option value="保證金" ${evtDetail.feeName === '保證金' ? 'selected' : ''}>保證金</option>
                                    <option value="場地清潔費" ${evtDetail.feeName === '場地清潔費' ? 'selected' : ''}>場地清潔費</option>
                                    <option value="教材費" ${evtDetail.feeName === '教材費' ? 'selected' : ''}>教材費</option>
                                </select>
                            </div>
                            <div class="col-6" id="ee-fee-amount-box" style="display: ${feeBoxDisplay};">
                                <label class="form-label fw-bold text-dark">收費金額</label>
                                <input type="number" id="ee-feeAmount" class="form-control border-warning" value="${evtDetail.feeAmount || ''}">
                            </div>

                            <div class="col-12 mt-2">
                              <label class="form-label fw-bold text-dark">宣傳海報 (若要更換請上傳新圖)</label>
                              <div class="form-text text-primary mb-2" style="font-size: 0.85rem;"><i class="fas fa-lightbulb"></i> <b>建議比例：16:9 或 4:3 (橫式圖佳)</b></div>
                              <input type="file" class="form-control mb-2" id="ee-poster-file" accept="image/*" onchange="compressEditImage(event)">
                              <input type="hidden" id="ee-poster-base64">
                              
                              <div class="text-center bg-light p-2 rounded border">
                                <img id="edit-poster-preview-img" src="${evtDetail.posterUrl || ''}" style="max-height: 150px; border-radius: 8px; ${evtDetail.posterUrl ? '' : 'display:none;'}">
                                <div id="edit-poster-status" class="text-muted mt-1" style="font-size:0.8rem;">${evtDetail.posterUrl ? '目前海報' : '尚未設定海報'}</div>
                              </div>
                            </div>

                            <div class="col-12">
                                <label class="form-label fw-bold text-dark">自訂報名選項</label>
                                <input type="text" id="ee-custom" class="form-control" value="${evtDetail.customForm || ''}">
                            </div>

                            <div class="col-12">
                                <label class="form-label fw-bold text-dark">詳細簡介</label>
                                <textarea id="ee-desc" class="form-control" rows="2">${evtDetail.description || ''}</textarea>
                            </div>

                            <div class="col-6 form-check form-switch mt-2">
                                <input class="form-check-input ms-0" type="checkbox" id="ee-proxy" ${proxyChecked}>
                                <label class="form-check-label fw-bold ms-2" for="ee-proxy">允許代為報名</label>
                            </div>
                            <div class="col-6 form-check form-switch mt-2">
                                <input class="form-check-input ms-0" type="checkbox" id="ee-extra" ${extraChecked}>
                                <label class="form-check-label fw-bold ms-2" for="ee-extra">必填身分證(保險)</label>
                            </div>
                        </div>
                    </div>
                `,
                showCancelButton: true, confirmButtonText: '儲存更新', cancelButtonText: '取消', confirmButtonColor: '#17a2b8',
                preConfirm: () => {
                    const fileInput = document.getElementById('ee-poster-file');
                    const posterBase64 = document.getElementById('ee-poster-base64').value;
                    if (fileInput.files.length > 0 && !posterBase64) {
                        Swal.showValidationMessage('圖片處理中，請稍候幾秒再按儲存'); return false;
                    }
                }
            }).then(result => {
                if(result.isConfirmed) {
                    const formatTime = (t) => t ? t.replace('T', ' ').replace(/-/g, '/') : "";
                    let updatedPayload = {
                        id: evtDetail.id,
                        name: document.getElementById('ee-name').value.trim(),
                        status: document.getElementById('ee-status').value,
                        category: document.getElementById('ee-category').value,
                        groupId: document.getElementById('ee-groupId').value.trim(),
                        start: formatTime(document.getElementById('ee-start').value),
                        end: formatTime(document.getElementById('ee-end').value),
                        regEnd: formatTime(document.getElementById('ee-regEnd').value),
                        capacity: document.getElementById('ee-cap').value,
                        feeName: document.getElementById('ee-feeName').value,
                        feeAmount: document.getElementById('ee-feeAmount').value,
                        desc: document.getElementById('ee-desc').value.trim(),
                        customOpt: document.getElementById('ee-custom').value.trim(),
                        proxy: document.getElementById('ee-proxy').checked, 
                        extra: document.getElementById('ee-extra').checked,
                        posterBase64: document.getElementById('ee-poster-base64').value, // 傳送新圖
                        poster: evtDetail.posterUrl // 保留舊圖網址作為備案
                    };

                    Swal.fire({ title: '儲存與更新中', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                    fetch(gasUrl, { method: 'POST', body: JSON.stringify({ action: 'adminUpdateEventConfig', adminUid: currentUID, eventData: updatedPayload }) })
                        .then(res => res.json()).then(res => {
                            if(res.success) Swal.fire('成功', res.message, 'success').then(() => loadManageEventList());
                            else Swal.fire('錯誤', res.message, 'error');
                        }).catch(err => Swal.fire('連線錯誤', err.message, 'error'));
                }
            });
        }).catch(err => Swal.fire('連線錯誤', '無法抓取活動詳細資料', 'error'));
}
// ========== 👆 替換到這裡為止 👆 ==========


function deleteEvent(eventId, eventName) {
    Swal.fire({
      title: '您確定要強制刪除活動嗎？', 
      html: `活動：<b>${eventName}</b><br><br><span class="text-danger fw-bold">此操作不可逆！</span><br>這將會刪除該活動，以及<b>所有人</b>報名此活動的紀錄！`, 
      icon: 'warning',
      showCancelButton: true, confirmButtonColor: '#e74c3c', confirmButtonText: '是的，全部刪除！'
    }).then((result) => {
      if (result.isConfirmed) {
        Swal.fire({ title: '銷毀中...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const gasUrl = window.CONFIG.GAS_URL;
        fetch(gasUrl, { method: 'POST', body: JSON.stringify({ action: 'adminDeleteEvent', adminUid: currentUID, eventId: eventId }) })
          .then(res => res.json()).then(res => {
            if(res.success) Swal.fire('已刪除', res.message, 'success').then(()=>loadManageEventList());
            else Swal.fire('錯誤', res.message, 'error');
          }).catch(err => Swal.fire('連線錯誤', err.message, 'error'));
      }
    });
  }

function loadArchiveEventList() {
  document.getElementById('archive-event-loading').style.display = 'block';
  document.getElementById('archive-event-list').style.display = 'none';
  
  const gasUrl = window.CONFIG.GAS_URL;
  fetch(`${gasUrl}?action=getArchivedEvents&uid=${currentUID}`)
    .then(res => res.json())
    .then(res => {
      document.getElementById('archive-event-loading').style.display = 'none';
      if (res.success) {
        renderArchiveEventList(res.list);
      } else {
        document.getElementById('archive-event-list').innerHTML = `<div class="alert alert-danger">${res.message}</div>`;
        document.getElementById('archive-event-list').style.display = 'block';
      }
    }).catch(err => {
      document.getElementById('archive-event-loading').style.display = 'none';
      document.getElementById('archive-event-list').innerHTML = `<div class="alert alert-danger">連線失敗</div>`;
      document.getElementById('archive-event-list').style.display = 'block';
    });
}

function renderArchiveEventList(list) {
  const container = document.getElementById('archive-event-list');
  container.innerHTML = '';

  if (list.length === 0) {
    container.innerHTML = '<div class="text-center text-muted py-4">目前沒有已封存的歷史活動</div>';
  } else {
    list.forEach((evt) => {
      container.innerHTML += `
        <div class="list-group-item p-3 border-bottom border-0 bg-light">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <h6 class="fw-bold text-secondary mb-0"><i class="fas fa-lock"></i> ${evt.name}</h6>
            <span class="badge bg-secondary ms-1" style="font-size:0.75rem;">${evt.status}</span>
          </div>
          <div class="text-muted mb-2" style="font-size:0.85rem;">
            <i class="far fa-calendar-alt w-20px"></i> ${evt.start} <br>
            <i class="fas fa-hashtag w-20px"></i> ID: <span style="font-family:monospace;">${evt.id}</span>
          </div>
          <div class="text-end mt-2">
            <button class="btn btn-sm btn-secondary rounded-pill px-3 shadow-sm" onclick="loadArchivedEventReport('${evt.id}')"><i class="fas fa-eye"></i> 檢視名單 (唯讀)</button>
          </div>
        </div>
      `;
    });
  }
  container.style.display = 'block';
}

function loadArchivedEventReport(eventId) {
  document.getElementById('print-section').style.display = 'none';
  Swal.fire({ title: '撈取歷史名單中', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

  const gasUrl = window.CONFIG.GAS_URL;
  fetch(`${gasUrl}?action=getArchivedEventRegistrations&uid=${currentUID}&eventId=${eventId}`)
    .then(res => res.json()).then(res => {
      if (res.success) {
        Swal.close();
        toggleEventView('report');
        document.getElementById('report-event-select').value = ""; 
        
        document.getElementById('print-section').style.display = 'block';
        document.getElementById('print-event-name').innerText = res.eventInfo.name + " (已封存)";
        document.getElementById('print-event-time').innerText = `活動時間：${res.eventInfo.date} | 報名人數：${res.list.length} 人`;
        
        let tbody = document.getElementById('report-tbody');
        tbody.innerHTML = ''; 
        currentReportData = res.list; 
        
        if (res.list.length === 0) { 
          tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4 fw-bold">此歷史活動尚無報名紀錄</td></tr>'; 
        } else {
          res.list.forEach((reg, index) => {
            let attClass = reg.attendance === '已出席' ? 'text-success' : 'text-danger';
            let payBadge = reg.payStatus === '已繳費' ? '<span class="badge bg-success">已繳費</span>' : (reg.payStatus === '免繳費' ? '<span class="badge bg-secondary">免繳費</span>' : '<span class="badge bg-warning text-dark">未繳費</span>');
            let readableExtra = parseExtraInfoToReadable(reg.extraInfo);

            tbody.innerHTML += `<tr>
              <td class="text-center fw-bold">${index + 1}</td>
              <td class="fw-bold text-secondary">${reg.participantName}</td>
              <td class="text-center text-muted">${reg.type}</td>
              <td class="text-center">${reg.phone}</td>
              <td class="text-center">${payBadge}</td>
              <td class="text-center fw-bold ${attClass} print-blank-cell"><span class="no-print">${reg.attendance}</span></td>
              <td class="text-muted" style="font-size:0.85rem; max-width:250px;">${readableExtra}</td>
              <td class="text-center no-print text-muted" style="font-size:0.8rem;">
                <i class="fas fa-lock"></i> 唯讀
              </td>
            </tr>`;
          });
        }
      } else { Swal.fire('錯誤', res.message, 'error'); }
    }).catch(err => Swal.fire('連線錯誤', err.message, 'error'));
}

function loadFinancialSummary() {
  const yearInput = document.getElementById('finance-year-input').value || new Date().getFullYear();
  
  document.getElementById('finance-loading').style.display = 'block';
  document.getElementById('finance-dashboard-view').style.display = 'none';

  const gasUrl = window.CONFIG.GAS_URL;
  fetch(`${gasUrl}?action=getFinancialSummary&uid=${currentUID}&year=${yearInput}`)
    .then(res => res.json())
    .then(res => {
      document.getElementById('finance-loading').style.display = 'none';
      if (res.success) {
         document.getElementById('finance-dashboard-view').style.display = 'block';
         document.getElementById('fin-total-amount').innerText = '$ ' + res.total.toLocaleString();
         renderFinanceCharts(res);
      } else {
         Swal.fire('錯誤', res.message, 'error');
      }
    }).catch(err => {
      document.getElementById('finance-loading').style.display = 'none';
      Swal.fire('連線錯誤', err.message, 'error');
    });
}

function renderFinanceCharts(data) {
  const healthContainer = document.getElementById('finance-health-container');
  if (healthContainer) {
      const targetYear = Number(data.year);
      const budget = data.budget || 0;
      const currentTotal = data.total || 0;
      
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

      // 【修改】全新定義的三階段健康度與文案 (後台)
      let colorClass = "bg-danger"; 
      let statusText = "嚴重落後";
      let icon = "fa-exclamation-circle text-danger";
      
      if (healthRatio >= 70) {
          colorClass = "bg-success"; statusText = "安全範圍"; icon = "fa-check-circle text-success";
      } else if (healthRatio >= 50) {
          colorClass = "bg-warning"; statusText = "警戒範圍"; icon = "fa-exclamation-triangle text-warning";
      }

      if (daysPassed === 0) { statusText = "尚未開始"; icon = "fa-info-circle text-muted"; colorClass = "bg-secondary"; }

      healthContainer.innerHTML = `
        <div class="d-flex justify-content-between align-items-end mb-1" style="font-size:0.85rem;">
          <span class="fw-bold text-muted">年度預算：$${budget.toLocaleString()}</span>
          <span class="fw-bold" style="cursor: pointer;" data-bs-toggle="modal" data-bs-target="#healthInfoModal">
              <i class="fas ${icon}"></i> ${statusText} <i class="fas fa-question-circle ms-1 text-muted"></i>
          </span>
        </div>
        <div class="progress" style="height: 12px; background-color:#e9ecef; border-radius: 10px;">
          <div class="progress-bar progress-bar-striped progress-bar-animated ${colorClass}" role="progressbar" style="width: ${visualRatio}%;"></div>
        </div>
        <div class="text-end mt-1 text-muted" style="font-size:0.75rem;">
          時間進度：第 ${daysPassed} 天 / 應達標：$${expectedTarget.toLocaleString()} <br>
          <strong class="text-dark">當前健康度：${healthRatio.toFixed(1)}%</strong>
        </div>
      `;
  }
  
  const catCtx = document.getElementById('financeCategoryChart');
      if(catCtx) {
         if(window.myAdminDonationCatChart) window.myAdminDonationCatChart.destroy();
         
         // 【新增排序】依照金額由大到小排序
         let sortedCats = Object.keys(data.categories).sort((a, b) => data.categories[b] - data.categories[a]);
         const labels = sortedCats;
         const values = sortedCats.map(cat => data.categories[cat]);
         
         // 【更換調色盤】與前台相同的友善色彩（綠色第一）
         const colorPalette = ['#2ecc71', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#34495e', '#95a5a6', '#e74c3c'];
         const colors = labels.map((cat, idx) => colorPalette[idx % colorPalette.length]);
         
         window.myAdminDonationCatChart = new Chart(catCtx, {
            type: 'doughnut',
            data: {
               labels: labels,
               datasets: [{ data: values, backgroundColor: colors, borderWidth: 1 }]
            },
            options: {
               responsive: true, maintainAspectRatio: false,
               plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 10 } } } },
               cutout: '60%'
            }
         });
      }

  const trendCtx = document.getElementById('financeTrendChart');
  if(trendCtx) {
     if(window.myAdminDonationTrendChart) window.myAdminDonationTrendChart.destroy();
     
     const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
     const values = [];
     for(let i=1; i<=12; i++) { values.push(data.monthly[String(i)]); }
     
     window.myAdminDonationTrendChart = new Chart(trendCtx, {
        type: 'bar',
        data: {
           labels: months,
           datasets: [{
              label: '總奉獻金額',
              data: values,
              backgroundColor: 'rgba(241, 196, 15, 0.7)',
              borderColor: 'rgba(243, 156, 18, 1)',
              borderWidth: 1,
              borderRadius: 4
           }]
        },
        options: {
           responsive: true, maintainAspectRatio: false,
           scales: { y: { beginAtZero: true } },
           plugins: { legend: { display: false } }
        }
     });
  }
}

// ==========================================
// 【第五包新增】智慧財務 Excel 檔案解析引擎
// ==========================================
function processFinanceFile() {
  const fileInput = document.getElementById('finance-excel-input');
  if (!fileInput.files || fileInput.files.length === 0) {
      Swal.fire('提醒', '請先選擇一個 Excel 或 CSV 檔案！', 'warning');
      return;
  }
  
  const file = fileInput.files[0];
  const reader = new FileReader();

  Swal.fire({ title: '解析檔案中', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

  reader.onload = function(e) {
      try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, {type: 'array'});
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          const rawRows = XLSX.utils.sheet_to_json(worksheet, {header: 1});
          
          if(rawRows.length < 3) {
             Swal.fire('解析失敗', '檔案內容似乎為空或格式不符。', 'error');
             return;
          }

          let parsedDate = Utilities_formatDateClient(new Date()); 
          let cleanData = [];
          let expectedCount = 0;
          let expectedSum = 0;
          
          for (let i = 0; i < rawRows.length; i++) {
              let row = rawRows[i];
              if(!row || row.length === 0) continue;
              
              let col0 = String(row[0] || "").trim();
              let col1 = String(row[1] || "").trim();
              
              // 1. 抓取日期 (從前 5 行尋找包含 YYYY/MM/DD 的儲存格)
              if (i <= 5 && col0.match(/(\d{4}\/\d{1,2}\/\d{1,2})/)) {
                 parsedDate = col0.match(/(\d{4}\/\d{1,2}\/\d{1,2})/)[1];
                 continue; 
              }

              // 2. 判斷是否為小計或總計列
              if (col0.includes("共計") || col0.includes("總計") || col1.includes("總計")) {
                 let fullRowStr = row.join(" ");
                 let countMatch = fullRowStr.match(/(\d+)\s*人/);
                 if (countMatch) expectedCount = parseInt(countMatch[1]);
                 
                 for(let c = row.length - 1; c >= 1; c--) {
                     let val = String(row[c] || "").replace(/,/g, "").trim();
                     if(val && !isNaN(val) && Number(val) > 0) {
                         expectedSum = Number(val);
                         break;
                     }
                 }
                 continue; 
              }

              // 3. 過濾無效資料或表頭
              if (!col0 || col0 === "科目代碼" || col0 === "教會名稱" || col0.includes("教會")) continue;

              // 4. 標準資料列提取 (精準對位版)
              let accountCode = col0;                                         // A欄: 科目代碼
              let itemName = col1;                                            // B欄: 會計科目
              let donationCode = String(row[2] || "").trim();                 // C欄: 奉獻代碼
              let personName = String(row[3] || "").trim();                   // D欄: 姓名
              let amountStr = String(row[4] || "").replace(/,/g, "").trim();  // E欄: 金額
              let memo = String(row[5] || "").trim();                         // F欄: 備註

              if (amountStr.indexOf('.') > 0 && amountStr.split('.')[1].length === 3) {
                  amountStr = amountStr.replace(/\./g, "");
              }
              
              let amount = Number(amountStr);

              // 確保是有效的奉獻紀錄
              if (amount > 0 && personName && personName !== "無名氏") {
                 let familyId = donationCode.split("-")[0] || "";
                 cleanData.push({
                    date: parsedDate,
                    accountCode: accountCode,
                    itemName: itemName,
                    donationCode: donationCode,
                    familyId: familyId,
                    personName: personName,
                    amount: amount,
                    memo: memo
                 });
              }
          }

          if (cleanData.length === 0) {
              Swal.fire('解析失敗', '無法從檔案中提取有效的奉獻資料，請檢查檔案格式。', 'error');
              return;
          }

          // 5. 雙重核對邏輯 (Double Check)
          currentFinancePreviewData = cleanData;
          let actualCount = cleanData.length;
          let actualSum = cleanData.reduce((sum, curr) => sum + curr.amount, 0);
          
          let checkStatusHtml = "";
          if (expectedCount === actualCount && expectedSum === actualSum) {
              checkStatusHtml = `<div class="alert alert-success p-2 mb-2" style="font-size:0.85rem;">
                 <i class="fas fa-check-circle"></i> <b>雙重核對通過！</b><br>
                 系統抓取的 <b>${actualCount}</b> 筆資料，總額 <b>$ ${actualSum.toLocaleString()}</b>，與報表最後的總計完全吻合！
              </div>`;
          } else {
              checkStatusHtml = `<div class="alert alert-danger p-2 mb-2" style="font-size:0.85rem;">
                 <i class="fas fa-exclamation-triangle"></i> <b>雙重核對警告！資料可能有漏抓</b><br>
                 系統抓取的總筆數：<b>${actualCount}</b> 筆，總金額：<b>$ ${actualSum.toLocaleString()}</b><br>
                 報表底部的總計為：<b>${expectedCount}</b> 筆，總金額：<b>$ ${expectedSum.toLocaleString()}</b><br>
                 請仔細核對下方明細，或手動修正 Excel 後重新上傳！
              </div>`;
          }

          let previewHtml = checkStatusHtml + `
            <div class="alert alert-warning p-2 mb-2 border" style="font-size:0.85rem;">
               ⚠️ <b>覆蓋警告：</b> 系統將以 <b>${parsedDate}</b> 為基準日，若資料庫已有同日期的紀錄將會被<b>自動覆蓋</b>，以避免重複寫入！
            </div>
            <table class="table table-sm table-bordered table-striped" style="font-size:0.8rem;">
               <thead class="table-light"><tr><th>代碼</th><th>科目</th><th>奉獻代碼</th><th>姓名</th><th>金額</th></tr></thead>
               <tbody>
          `;
          
          let maxPreview = Math.min(5, cleanData.length);
          for(let i=0; i<maxPreview; i++) {
             previewHtml += `<tr>
                <td>${cleanData[i].accountCode}</td>
                <td>${cleanData[i].itemName}</td>
                <td>${cleanData[i].donationCode}</td>
                <td>${cleanData[i].personName}</td>
                <td class="text-end fw-bold">$${cleanData[i].amount.toLocaleString()}</td>
             </tr>`;
          }
          previewHtml += `</tbody></table>`;
          
          previewHtml += `
            <button class="btn btn-warning w-100 fw-bold rounded-pill shadow-sm" onclick="confirmFinanceUpload()">
               <i class="fas fa-database"></i> 忽略警告/確認無誤，一鍵寫入資料庫
            </button>
          `;

          document.getElementById('finance-preview-area').innerHTML = previewHtml;
          document.getElementById('finance-preview-area').style.display = 'block';
          document.getElementById('btn-upload-finance').style.display = 'none';
          
          Swal.close();

      } catch (error) {
          Swal.fire('解析失敗', '發生錯誤：' + error.message, 'error');
      }
  };
  
  reader.readAsArrayBuffer(file);
}

// 簡單的客戶端日期格式化工具
function Utilities_formatDateClient(date) {
    let d = new Date(date),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();
    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;
    return [year, month, day].join('/');
}

// 【第五包新增】一鍵安全寫入已清洗好的 JSON 陣列
function confirmFinanceUpload() {
   if (!currentFinancePreviewData || currentFinancePreviewData.length === 0) return;
   
   Swal.fire({ title: '寫入資料庫中', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
   
   const gasUrl = window.CONFIG.GAS_URL;
   fetch(gasUrl, { 
      method: 'POST', 
      body: JSON.stringify({ 
          action: 'uploadFinanceJSON', 
          adminUid: currentUID, 
          financeData: currentFinancePreviewData 
      }) 
   })
   .then(res => res.json()).then(res => {
      if(res.success) { 
         Swal.fire('寫入成功', res.message, 'success').then(() => {
            // 寫入成功後重置上傳區塊
            document.getElementById('finance-excel-input').value = "";
            document.getElementById('finance-preview-area').style.display = 'none';
            document.getElementById('btn-upload-finance').style.display = 'block';
            currentFinancePreviewData = [];
            // 重新載入年度圖表
            loadFinancialSummary();
         });
      }
      else Swal.fire('匯入失敗', res.message, 'error');
   }).catch(err => Swal.fire('連線錯誤', err.message, 'error'));
}


// 【新增】控制新增活動的收費金額框顯示與隱藏
function toggleFeeAmountBox(val) {
  const amtBox = document.getElementById('fee-amount-box');
  if (val === "無" || !val) {
    amtBox.style.display = 'none';
    document.getElementById('ec-feeAmount').value = '';
  } else {
    amtBox.style.display = 'block';
  }
}


// ========== 👇 複製整段貼到 admin.js 檔案最底部 👇 ==========
// 【新增】自動生成現有群組編號下拉選單
function populateGroupIdDatalist() {
  const datalist = document.getElementById('existing-group-ids');
  if (!datalist || !adminData || !adminData.allAdminEvents) return;
  
  let groupIds = new Set();
  adminData.allAdminEvents.forEach(e => {
    if (e.groupId && e.groupId.trim() !== "") groupIds.add(e.groupId.trim());
  });
  
  datalist.innerHTML = '';
  groupIds.forEach(id => {
    datalist.innerHTML += `<option value="${id}"></option>`;
  });
}

// 【新增】編輯視窗專用的圖片壓縮引擎
function compressEditImage(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      let width = img.width; let height = img.height;
      const MAX_WIDTH = 800; 

      if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.7); 
      document.getElementById('ee-poster-base64').value = dataUrl;

      const previewImg = document.getElementById('edit-poster-preview-img');
      previewImg.src = dataUrl;
      previewImg.style.display = 'inline-block';
      document.getElementById('edit-poster-status').innerHTML = '<span class="text-success fw-bold"><i class="fas fa-check"></i> 新圖片已就緒</span>';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
// ========== 👆 貼到這裡為止 👆 ==========

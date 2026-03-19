window.onerror = function(msg, url, line) {
  alert("🚨 系統發生致命錯誤！請截圖回報給工程師。\n錯誤訊息：" + msg + "\n發生在第 " + line + " 行。");
};

let currentUID = ""; 
let globalUserName = "未綁定會友"; 

// 系統常數
const myLiffId = '2009444508-qaGGdlps';
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwa4MCwa6_Uky7EkbUcghr-_ikexNIbdYZY23U3oysE4Kv6jendZafVbyXB1_2Cpqo-/exec';

const urlParams = new URLSearchParams(window.location.search);
const targetPage = urlParams.get('page') || "profile";

document.addEventListener("DOMContentLoaded", function() {
  document.getElementById('loading').style.display = 'flex';
  
  if (!myLiffId) {
    alert("🚨 錯誤：網頁沒有設定 LIFF ID！");
    document.getElementById('loading').style.display = 'none';
    return;
  }

  liff.init({ liffId: myLiffId })
    .then(() => {
      if (!liff.isLoggedIn()) {
        // 【修復】已經在 GitHub Pages，可以直接使用標準的 liff.login() 語法，解決無痕模式卡住的問題
        document.getElementById('loading').innerHTML = `
          <div class="text-center px-4">
            <i class="fab fa-line fa-4x text-success mb-3"></i>
            <h4 class="fw-bold mb-3 text-dark">等待登入驗證</h4>
            <p class="text-muted mb-4" style="font-size:0.95rem;">為了確保會友資料安全，<br>請點擊下方按鈕授權 LINE 登入。</p>
            <button class="btn btn-success w-100 py-2 rounded-pill shadow-sm" onclick="liff.login({ redirectUri: window.location.href });">
              <i class="fas fa-sign-in-alt"></i> 點此授權登入
            </button>
          </div>
        `;
      } else {
        liff.getProfile().then(profile => {
          currentUID = profile.userId;         
          const lineName = profile.displayName;
          fetchUserData(currentUID, lineName);
        }).catch(err => {
          alert("🚨 錯誤：無法取得 LINE 帳號資料\n" + err.message);
          document.getElementById('loading').style.display = 'none';
        });
      }
    })
    .catch((err) => {
      alert('🚨 錯誤：LIFF 啟動失敗！請檢查 LIFF ID 設定。\n' + err.message);
      document.getElementById('loading').style.display = 'none';
    });
});

// 【新增】頁面切換邏輯 (搭配底部導覽列使用)
function switchPage(pageId) {
  const pages = ['profile', 'finance', 'prayer', 'events'];
  pages.forEach(p => {
    if (document.getElementById('page-' + p)) {
      document.getElementById('page-' + p).style.display = 'none';
    }
    if (document.getElementById('nav-' + p)) {
      document.getElementById('nav-' + p).classList.remove('active');
    }
  });

  if (document.getElementById('page-' + pageId)) {
    document.getElementById('page-' + pageId).style.display = 'block';
  }
  if (document.getElementById('nav-' + pageId)) {
    document.getElementById('nav-' + pageId).classList.add('active');
  }

  // 如果切換到奉獻頁面，且權限允許，則渲染圖表
  if (pageId === 'finance' && document.getElementById('finance-unlocked').style.display === 'block') {
    renderDonationChart();
  }
}

function fetchUserData(uid, lineName) {
  fetch(`${GAS_URL}?action=getUser&uid=${uid}`)
    .then(response => response.json())
    .then(response => {
      document.getElementById('loading').style.display = 'none'; 
      
      if(response.found) {
        globalUserName = response.name; 
        document.getElementById("ui-userName").innerText = response.name + "，平安！";
        
        let tierName = response.tier === 'Tier 2' ? "Tier 2 驗證用戶" : "Tier 1 綁定用戶";
        let tierBadge = response.tier === 'Tier 2' ? "bg-warning text-dark" : "bg-primary text-white";
        
        document.getElementById("ui-userTier").className = "badge mt-2 " + tierBadge;
        document.getElementById("ui-userTier").innerHTML = '<i class="fas fa-medal"></i> ' + tierName + ' <i class="fas fa-question-circle ms-1"></i>';

        document.getElementById("info-phone").innerText = response.phone || "未填寫";
        document.getElementById("info-birthday").innerText = response.birthday || "未填寫";
        document.getElementById("info-service").innerText = response.service;
        document.getElementById("info-groups").innerText = response.groups || "未設定";
        
        document.getElementById("input-phone").value = response.phone;
        document.getElementById("input-birthday").value = response.birthday;

        const serviceContainer = document.getElementById("checkbox-services");
        serviceContainer.innerHTML = "";
        const userServices = (response.service || "").split("、").map(s => s.trim());

        if (response.availableServices && response.availableServices.length > 0) {
          response.availableServices.forEach((serviceName, index) => {
            const isChecked = userServices.includes(serviceName) ? "checked" : "";
            const chkHtml = `
              <div class="col-6 form-check mb-2">
                <input class="form-check-input" type="checkbox" value="${serviceName}" id="chk-srv-${index}" ${isChecked}>
                <label class="form-check-label text-muted" for="chk-srv-${index}" style="font-size: 0.9rem;">${serviceName}</label>
              </div>
            `;
            serviceContainer.innerHTML += chkHtml;
          });
        } else {
          serviceContainer.innerHTML = `<div class="col-12 text-muted" style="font-size: 0.8rem;">無可選擇的服事單位</div>`;
        }

        const groupContainer = document.getElementById("checkbox-groups");
        groupContainer.innerHTML = "";
        const userGroups = (response.groups || "").split("、").map(g => g.trim());

        if (response.availableGroups && response.availableGroups.length > 0) {
          response.availableGroups.forEach((groupName, index) => {
            const isChecked = userGroups.includes(groupName) ? "checked" : "";
            const chkHtml = `
              <div class="col-6 form-check mb-2">
                <input class="form-check-input" type="checkbox" value="${groupName}" id="chk-grp-${index}" ${isChecked}>
                <label class="form-check-label text-muted" for="chk-grp-${index}" style="font-size: 0.9rem;">${groupName}</label>
              </div>
            `;
            groupContainer.innerHTML += chkHtml;
          });
        } else {
          groupContainer.innerHTML = `<div class="col-12 text-muted" style="font-size: 0.8rem;">目前無開放訂閱的頻道</div>`;
        }

        document.getElementById("bound-profile-view").style.display = "block";
        document.getElementById("unbound-view").style.display = "none";
      } else {
        globalUserName = lineName;
        document.getElementById("ui-userName").innerText = lineName + "，您好！";
        document.getElementById("ui-userTier").className = "badge mt-2 bg-secondary text-white";
        document.getElementById("ui-userTier").innerHTML = '<i class="fas fa-user"></i> Tier 0 一般用戶 <i class="fas fa-question-circle ms-1"></i>';
        document.getElementById("unbound-view").style.display = "block";
        document.getElementById("bound-profile-view").style.display = "none";
      }
      
      if(targetPage === 'finance') {
        document.getElementById('dynamicYear').innerText = response.sysYear; 
        document.getElementById('finance-locked').style.display = (response.tier === 'Tier 2' && response.found) ? 'none' : 'block';
        document.getElementById('finance-unlocked').style.display = (response.tier === 'Tier 2' && response.found) ? 'block' : 'none';
      }

      // 載入完成後，自動切換到目標頁面
      switchPage(targetPage);
    })
    .catch(error => {
      alert("🚨 資料庫連線失敗！\n" + error.message);
      document.getElementById('loading').style.display = 'none';
    });
}

function submitBinding() {
  const name = document.getElementById('bind-name').value.trim();
  const phone = document.getElementById('bind-phone').value.trim();
  const birthday = document.getElementById('bind-birthday').value;

  if (!name || !phone || !birthday) {
    alert("⚠️ 為了維護教會資料完整性，請完整填寫真實姓名、電話與生日喔！");
    return;
  }

  const btn = document.querySelector('#unbound-view .btn-warning');
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 系統處理中...';

  fetch(GAS_URL, {
    method: 'POST',
    body: JSON.stringify({
      action: 'bindUser',
      uid: currentUID,
      lineName: globalUserName, 
      realName: name,
      phone: phone,
      birthday: birthday
    })
  })
  .then(res => res.json())
  .then(res => {
    if(res.success) {
      alert(res.message);
      window.location.reload(); 
    } else {
      alert("⚠️ " + res.message);
      btn.innerHTML = '<i class="fas fa-link"></i> 一鍵綁定 / 註冊';
    }
  })
  .catch(error => {
    alert("連線錯誤：" + error.message);
    btn.innerHTML = '<i class="fas fa-link"></i> 一鍵綁定 / 註冊';
  });
}

function saveProfile() {
  const btn = document.querySelector('#editProfileModal .btn-primary');
  const newPhone = document.getElementById('input-phone').value;
  const newBirthday = document.getElementById('input-birthday').value;
  
  let newServicesArray = [];
  document.querySelectorAll('#checkbox-services input[type="checkbox"]:checked').forEach(chk => newServicesArray.push(chk.value));
  const newServiceStr = newServicesArray.join('、');

  let newGroupsArray = [];
  document.querySelectorAll('#checkbox-groups input[type="checkbox"]:checked').forEach(chk => newGroupsArray.push(chk.value));
  const newGroupsStr = newGroupsArray.join('、');
  
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 儲存中...';
  
  fetch(GAS_URL, {
    method: 'POST', 
    body: JSON.stringify({ 
      action: 'saveProfile', 
      uid: currentUID, 
      phone: newPhone, 
      birthday: newBirthday, 
      groups: newGroupsStr,
      service: newServiceStr 
    })
  })
  .then(res => res.json())
  .then(res => {
    if(res.success) {
      alert('✅ 資料已成功更新！');
      window.location.reload(); 
    } else {
      alert('錯誤：' + res.message);
      btn.innerHTML = '儲存修改';
    }
  })
  .catch(err => {
    alert("連線錯誤：" + err.message);
    btn.innerHTML = '儲存修改';
  });
}

function renderDonationChart() {
  const canvas = document.getElementById('donationChart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const dataValues = [22100, 7800, 2600]; 
  const totalAmount = dataValues.reduce((a, b) => a + b, 0); 
  
  if (window.myDonationChart) {
    window.myDonationChart.destroy();
  }

  window.myDonationChart = new Chart(ctx, { 
    type: 'doughnut', 
    data: { 
      labels: ['月定獻金', '感恩獻金', '對外獻金-本宗'], 
      datasets: [{ 
        data: dataValues, 
        backgroundColor: ['#3498db', '#2ecc71', '#f1c40f'], 
        borderWidth: 0 
      }] 
    }, 
    options: { 
      responsive: true, 
      maintainAspectRatio: false, 
      plugins: { 
        legend: { position: 'bottom' }, 
        tooltip: { 
          callbacks: { 
            label: function(context) { 
              const label = context.label || '';
              const value = context.raw;
              const percentage = Math.round((value / totalAmount) * 100);
              return `${label}: $ ${value.toLocaleString()} (${percentage}%)`; 
            } 
          } 
        } 
      }, 
      cutout: '70%' 
    } 
  });
}

function applyFinanceAccess() { 
  alert("已發送申請！請等候辦公室同工審核開通。"); 
}

function toggleFamilyView() { 
  const isChecked = document.getElementById('familySwitch').checked;
  alert(isChecked ? "已切換至【全戶視角】" : "已切換至【個人視角】"); 
}

function submitPrayer() {
  const target = document.getElementById('prayer-target').value;
  const content = document.getElementById('prayer-content').value;
  const isPublic = document.querySelector('input[name="prayer-public"]:checked').value;
  
  if(!target || !content) {
    alert("請填寫代禱對象與內容！");
    return;
  }
  
  const btn = document.querySelector('#page-prayer .btn-primary'); 
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 傳送中...';
  
  fetch(GAS_URL, {
    method: 'POST', 
    body: JSON.stringify({ 
      action: 'submitPrayer', 
      uid: currentUID, 
      userName: globalUserName, 
      target: target, 
      content: content, 
      isPublic: isPublic 
    })
  })
  .then(res => res.json())
  .then(res => {
    if (res.success) {
      alert('🙏 您的代禱事項已成功送出！');
      document.getElementById('prayerForm').reset();
      btn.innerHTML = '<i class="fas fa-paper-plane"></i> 送出代禱';
    } else {
      alert('系統錯誤：' + res.message);
      btn.innerHTML = '<i class="fas fa-paper-plane"></i> 重新送出';
    }
  })
  .catch(err => {
    alert("連線錯誤：" + err.message);
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> 重新送出';
  });
}

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
  toggleProxyFields(); 
  document.getElementById('regAgree').checked = false;
  
  new bootstrap.Modal(document.getElementById('regModal')).show();
}

function toggleProxyFields() { 
  document.getElementById('proxyFields').style.display = (document.getElementById('regProxyType').value === 'proxy') ? 'block' : 'none'; 
}

function submitRegistration() {
  if (!document.getElementById('regAgree').checked) {
    alert("請先勾選同意收集資料聲明喔！");
    return;
  }
  
  const eventId = document.getElementById('regEventId').value; 
  const isProxy = (document.getElementById('regProxyType').value === 'proxy');
  
  let pName = globalUserName;
  let pPhone = document.getElementById('info-phone').innerText; 
  
  if (isProxy) { 
    pName = document.getElementById('regParticipantName').value; 
    pPhone = document.getElementById('regParticipantPhone').value; 
    if (!pName) {
      alert("請填寫「參與者真實姓名」！");
      return;
    } 
  }
  
  let extraObj = {};
  if (document.getElementById('extraInfoSection').style.display !== 'none') { 
    const idNumber = document.getElementById('regIdNumber').value; 
    const dob = document.getElementById('regDob').value; 
    if (!idNumber || !dob) {
      alert("保險需填寫身分證與生日！");
      return;
    } 
    extraObj.身分證 = idNumber;
    extraObj.生日 = dob; 
  }
  
  const memoVal = document.getElementById('regMemo').value;
  if (memoVal) {
    extraObj.備註 = memoVal;
  }
  
  const btn = document.querySelector('#regModal .btn-primary');
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 處理中...';
  
  fetch(GAS_URL, {
    method: 'POST', 
    body: JSON.stringify({ 
      action: 'submitRegistration', 
      eventId: eventId, 
      uid: currentUID, 
      isProxy: isProxy, 
      participantName: pName, 
      participantPhone: pPhone, 
      extraInfoStr: JSON.stringify(extraObj) 
    })
  })
  .then(res => res.json())
  .then(res => {
    if (res.success) {
      alert("🎉 " + res.message);
      bootstrap.Modal.getInstance(document.getElementById('regModal')).hide();
      document.getElementById('regForm').reset(); 
    } else {
      alert("⚠️ " + res.message);
    }
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> 確定送出報名';
  })
  .catch(err => {
    alert("連線錯誤：" + err.message);
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> 確定送出報名';
  });
}

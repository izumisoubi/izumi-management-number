(function(){
  'use strict';

  const DRAFT_KEY='izumi_sales_demo_estimate_current_v2';
  const FORMAT='estimate-order-cost-invoice-standalone';
  const originalBuildSaveData=window.buildSaveData;
  const originalLoadAllFromText=window.loadAllFromText;
  let autosaveTimer=null;

  function clone(value){
    return JSON.parse(JSON.stringify(value??null));
  }

  function collectFields(){
    const fields={};
    document.querySelectorAll('input[id]:not([type="file"]),select[id],textarea[id]').forEach(element=>{
      fields[element.id]=element.type==='checkbox'||element.type==='radio'
        ?{checked:element.checked,value:element.value}
        :{value:element.value};
    });
    return fields;
  }

  function applyFields(fields){
    Object.entries(fields||{}).forEach(([id,saved])=>{
      const element=document.getElementById(id);
      if(!element||element.type==='file')return;
      if(saved&&Object.prototype.hasOwnProperty.call(saved,'checked'))element.checked=!!saved.checked;
      if(saved&&Object.prototype.hasOwnProperty.call(saved,'value')){
        if(element.tagName==='SELECT'&&saved.value&&!Array.from(element.options).some(option=>option.value===saved.value)){
          element.add(new Option(saved.value,saved.value));
        }
        element.value=saved.value??'';
      }
    });
  }

  function standaloneExtras(){
    return {
      format:FORMAT,
      version:1,
      savedAt:new Date().toISOString(),
      theme:document.body.className,
      fields:collectFields(),
      masters:{
        clients:clone(clientList2),
        vendors:clone(vendorDetails),
        employees:clone(employeeList),
        properties:clone(propertyList)
      }
    };
  }

  window.buildSaveData=function(){
    const data=originalBuildSaveData();
    data.standalone=standaloneExtras();
    return data;
  };

  function saveDraft(showStatus){
    try{
      localStorage.setItem(DRAFT_KEY,JSON.stringify(window.buildSaveData()));
      if(showStatus){
        const time=new Date().toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});
        setOnlineSaveStatus('ブラウザ内保存済 '+time,'saved');
      }
      return true;
    }catch(error){
      setOnlineSaveStatus('ブラウザ内保存に失敗','error');
      return false;
    }
  }

  function restoreMasters(masters){
    if(!masters||typeof masters!=='object')return;
    if(Array.isArray(masters.clients))clientList2=clone(masters.clients);
    if(Array.isArray(masters.vendors))vendorDetails=clone(masters.vendors);
    if(Array.isArray(masters.employees))employeeList=clone(masters.employees);
    if(Array.isArray(masters.properties))propertyList=clone(masters.properties);
    saveClients2();
    saveVendors();
    saveEmployees();
    saveProperties();
    rebuildStaffSelect(document.getElementById('b-staff')?.value||'');
    rebuildVendorSel();
    renderEmployeeGrid();
    refreshSharedMasterScreens();
  }

  function refreshAfterLoad(){
    syncKeijoSelect();
    syncCompletedDate('basic');
    applyEstCo();
    applyInvCo();
    applyReportCo();
    syncEst();
    syncInv();
    syncReport();
    renderOrder();
    renderCostTable();
    renderEmployeeGrid();
  }

  window.loadAllFromText=function(text){
    let data;
    try{
      data=JSON.parse(text);
      if(!data||typeof data!=='object')throw new Error('JSONの形式が正しくありません');
    }catch(error){
      alert('読み込み失敗: '+error.message);
      return false;
    }
    originalLoadAllFromText(text);
    if(data.standalone?.theme)document.body.className=data.standalone.theme;
    restoreMasters(data.standalone?.masters);
    applyFields(data.standalone?.fields);
    refreshAfterLoad();
    saveDraft(true);
    showToastMsg('✅ JSONを読み込みました');
    return true;
  };

  window.scheduleOnlineAutosave=function(delay=700){
    clearTimeout(autosaveTimer);
    setOnlineSaveStatus('ブラウザ内保存：変更あり','saving');
    autosaveTimer=setTimeout(()=>saveDraft(true),Math.max(250,Number(delay)||700));
  };

  window.cancelOnlineAutosave=function(){
    clearTimeout(autosaveTimer);
    autosaveTimer=null;
  };

  window.getLastOpenedManagementNumber=function(){
    return '';
  };

  window.saveAll=async function(){
    window.cancelOnlineAutosave();
    saveDraft(true);
    await saveBackupToPc();
    return true;
  };

  window.showStorageHelp=function(){
    const body=`
      <div class="storage-help">
        <div class="storage-help-intro"><b>この単体版はSupabaseや外部台帳へ接続しません。</b><br>入力内容はこのブラウザ内へ自動保存されます。長期保管や別のPCへ移す場合は、必ずJSONファイルも保存してください。</div>
        <div class="storage-help-card recommended"><strong>💾 JSON保存</strong><span>見積・発注・売上原価・請求・完了報告・各マスタを、1つのJSONファイルとしてPCへ保存します。</span></div>
        <div class="storage-help-card"><strong>🗂 JSON読込</strong><span>この単体版で保存したJSONを開き、続きを編集できます。</span></div>
        <div class="storage-help-note"><b>注意：</b>ブラウザの履歴やサイトデータを削除すると自動保存が消える場合があります。案件ごとにJSON保存してください。</div>
      </div>`;
    openMasterModal('単体版の保存について',body,null,null);
    hideMasterModalActions();
  };

  window.loadSharedMastersFromCloud=async function(){
    sharedMasterAdmin=true;
    sharedMastersReady=true;
    renderEmployeeGrid();
    return true;
  };

  window.saveSharedMasterRecord=async function(type,existing,updated){
    const map={
      vendor:{get:()=>vendorDetails,save:saveVendors},
      client:{get:()=>clientList2,save:saveClients2},
      property:{get:()=>propertyList,save:saveProperties}
    };
    const target=map[type];
    if(!target)return {error:{message:'未対応のマスタです'}};
    const list=target.get();
    const data={...updated};
    delete data._cloudId;
    const index=existing
      ?list.findIndex(item=>item===existing||(item.name===existing.name&&item.addr===existing.addr))
      :-1;
    if(index>=0)list[index]=data;
    else list.push(data);
    target.save();
    window.scheduleOnlineAutosave(250);
    return {data:data.name,error:null};
  };

  window.deleteSharedMasterRecord=async function(type,existing){
    const map={
      vendor:{get:()=>vendorDetails,save:saveVendors},
      client:{get:()=>clientList2,save:saveClients2},
      property:{get:()=>propertyList,save:saveProperties}
    };
    const target=map[type];
    if(!target)return {error:{message:'未対応のマスタです'}};
    const list=target.get();
    const index=list.findIndex(item=>item===existing||(item.name===existing.name&&item.addr===existing.addr));
    if(index>=0)list.splice(index,1);
    target.save();
    window.scheduleOnlineAutosave(250);
    return {data:true,error:null};
  };

  window.onEmpStampUpload=function(index,input){
    const file=input.files?.[0];
    if(!file)return;
    if(file.size>750000){
      input.value='';
      showToastMsg('印鑑画像は750KB以下にしてください。');
      return;
    }
    const reader=new FileReader();
    reader.onload=event=>{
      employeeList[index].stamp=String(event.target.result||'');
      saveEmployees();
      renderEmployeeGrid();
      refreshEmployeeStamps();
      window.scheduleOnlineAutosave(250);
      showToastMsg('印鑑を登録しました：'+employeeList[index].name);
    };
    reader.readAsDataURL(file);
  };

  window.clearStamp=async function(index){
    employeeList[index].stamp='';
    saveEmployees();
    renderEmployeeGrid();
    refreshEmployeeStamps();
    window.scheduleOnlineAutosave(250);
    showToastMsg('印鑑を削除しました：'+employeeList[index].name);
  };

  function addStandaloneNotice(){
    const notice=document.createElement('div');
    notice.id='standaloneNotice';
    notice.textContent='💾 単体版：Supabase・管理台帳・既存のサンプル装美システムには接続していません。入力内容はブラウザ内とJSONファイルだけに保存されます。';
    notice.style.cssText='padding:8px 16px;background:#fff7d6;border-bottom:1px solid #ead27a;color:#6f5515;font-size:11px;font-weight:700;text-align:center;';
    document.querySelector('.tabbar')?.insertAdjacentElement('afterend',notice);
  }

  init();
  addStandaloneNotice();
  sharedMasterAdmin=true;
  const draft=localStorage.getItem(DRAFT_KEY);
  if(draft)window.loadAllFromText(draft);
  else saveDraft(false);
  setOnlineSaveStatus('ブラウザ内保存：有効','saved');
})();

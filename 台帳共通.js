const SUPABASE_URL='https://jjowjnrsknmakcunblzq.supabase.co';
const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impqb3dqbnJza25tYWtjdW5ibHpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyNzY4MjUsImV4cCI6MjA5OTg1MjgyNX0.XYPEt90GQlzJMTe67f9O7WExNYrJhfQ_HC20kkCWgGs';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
const config=window.LEDGER_CONFIG;
const gridCore=window.IzumiGridCore;
const meetingPeriod=window.IzumiMeetingPeriod;
const fiscalYearCore=window.IzumiFiscalYear;
if(!gridCore)throw new Error('表入力共通.js を先に読み込んでください。');
if(config.viewKey==='meeting'&&!config.fields.some(field=>field.key==='meeting_checked')){
  config.fields.unshift({key:'meeting_checked',label:'翌月へ<br>繰越',type:'checkbox',width:'w-meeting'});
}
const APP_VERSION='正式版';
function normalizeStablePageUrls(){
  const current=new URL(location.href);
  if(current.searchParams.has('v')){
    current.searchParams.delete('v');
    history.replaceState(history.state,'',current.pathname+(current.searchParams.size?'?'+current.searchParams.toString():'')+current.hash);
  }
  document.querySelectorAll('a[href]').forEach(link=>{
    const target=new URL(link.getAttribute('href'),location.href);
    if(target.origin!==location.origin||!target.searchParams.has('v'))return;
    target.searchParams.delete('v');
    link.setAttribute('href',target.pathname+(target.searchParams.size?'?'+target.searchParams.toString():'')+target.hash);
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',normalizeStablePageUrls);
else normalizeStablePageUrls();
const MEETING_USERS_FALLBACK=new Set([
  'demachi@izumisoubi.co.jp',
  'iida@izumisoubi.co.jp',
  'ooshima@izumisoubi.co.jp',
  'tanaka@izumisoubi.co.jp'
]);
const workspaceWidths={billing:'1600px',management:'1600px',cost:'1600px',unordered:'1600px',meeting:'1600px'};
document.documentElement.style.setProperty('--workspace-width',config.workspaceWidth||workspaceWidths[config.viewKey]||'1600px');
document.documentElement.style.setProperty('--meeting-width',config.viewKey==='meeting'?'64px':'0px');
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const numberValue=value=>{const parsed=Number(String(value??'').replace(/[,，¥￥\s]/g,''));return Number.isFinite(parsed)?parsed:0};
const formatNumber=value=>Math.round(numberValue(value)).toLocaleString('ja-JP');
const money=value=>'¥'+formatNumber(value);
const monthOptions=['',...Array.from({length:12},(_,index)=>`${index+1}月`)];
const fiscalYearOptions=['',...(fiscalYearCore?.options({minimumCode:22,futureYears:3})||[]).map(item=>item.label)];
let projects=[],projectMap=new Map(),lineItems=[],employees=[],overrides=new Map(),overrideRevisions=new Map(),allRows=[],viewRows=[],isAdmin=false,currentUser=null,meetingAccessAllowed=false;
let sortField='management_number',sortDirection='desc',dragStart=null,dragging=false,activeCell=null,selectionFocus=null,checkboxBrush=null;
// 原価一覧は年度内の全件を一続きで確認する業務画面なので、ページ分割しない。
// 検索・集計・CSVも同じ全件を対象にする。他の台帳は従来どおり200件単位。
const continuousRows=config.continuousRows===true||config.viewKey==='cost';
let currentPage=1,pageSize=continuousRows?0:200,searchTimer=null,appOpening=false,ledgerRealtimeChannel=null,ledgerRealtimeTimer=null;
const continuousBatchSize=200;
let continuousRenderedCount=continuousBatchSize,continuousScrollFrame=0;
let loadedLedgerYear='';
let guideTargetCell=null,datePickerTarget=null,datePickerMonth=null,datePickerCloseTimer=null;
let quickHintTimer=null;
const saveTimers=new Map();
let pendingWritebackReconciliation=false;
const fieldGuides={
  meeting_checked:{mode:'manual',source:'会議用案件一覧 ＞ 翌月へ繰越',note:'チェックすると現在の会議月度から翌月へ送り、現在月の集計から外します。繰越先では行を薄紫で表示します。'},
  meeting_month:{mode:'manual',source:'会議用案件一覧 ＞ 会議月度',note:'この案件を集計する会議月度です。月度を変更すると繰越として記録し、元の月度は変更しません。'},
  management_number:{mode:'auto',source:'見積システム ＞ 基本情報 ＞ 管理番号',note:'管理番号マスターから選択した番号を自動同期します。'},
  reception_date:{mode:'auto',source:'見積システム ＞ 基本情報 ＞ 受付日'},
  input_date:{mode:'auto',source:'見積システム ＞ 基本情報 ＞ 受付日'},
  staff_name:{mode:'auto',source:'見積システム ＞ 基本情報 ＞ 工事担当者',note:'社員マスタの担当者が候補に表示されます。'},
  property_name:{mode:'auto',source:'見積システム ＞ 基本情報 ＞ 物件名・部屋番号'},
  property_room:{mode:'auto',source:'見積システム ＞ 基本情報 ＞ 物件名＋部屋番号'},
  work_name:{mode:'auto',source:'見積システム ＞ 基本情報 ＞ 工事名称／工事概要'},
  category:{mode:'auto',source:'見積システム ＞ 発注タブ ＞ 発注明細のカテゴリ'},
  vendor_name:{mode:'auto',source:'見積システム ＞ 発注タブ ＞ 業者担当'},
  estimate_amount_ex_tax:{mode:'auto',source:'見積システム ＞ 発注タブ ＞ 業者別の発注金額（税抜）'},
  invoice_amount_ex_tax:{mode:'mixed',source:'見積システム ＞ 発注タブ ＞ 外注請求金額、または台帳入力',note:'見積システムから自動同期します。台帳で上書きもでき、上書きを消すと自動同期値へ戻ります。'},
  variance_ex_tax:{mode:'calc',source:'請求金額（税抜）－見積金額（税抜）'},
  scheduled_completion_date:{mode:'auto',source:'見積システム ＞ 基本情報 ＞ 完工予定日'},
  completed_on:{mode:'auto',source:'見積システム ＞ 基本情報 ＞ 完工日',note:'見積の完工日だけを反映します。入金日から完工日を推測して上書きしません。'},
  invoice_to_customer_date:{mode:'auto',source:'見積システム ＞ 請求タブ ＞ 発行日',note:'経営会議の月次売上はこの請求書提出日の月で集計します。'},
  invoice_date:{mode:'auto',source:'見積システム ＞ 請求タブ ＞ 発行日',note:'経営会議の月次売上はこの日付の月で集計します。'},
  invoice_from_vendor_date:{mode:'manual',source:'外注先請求書の受領日をこの台帳で入力'},
  payment_date:{mode:'manual',source:'外注先への支払日をこの台帳で入力'},
  payment_month:{mode:'manual',source:'外注先への支払月をこの台帳で選択'},
  reminder_required:{mode:'manual',source:'この台帳で「要確認」をチェック',note:'後で確認が必要な原価行です。チェックすると行全体を薄い赤で表示します。'},
  notes:{mode:'mixed',source:'見積システムの備考を自動同期。必要に応じて台帳で上書き',note:'手入力を消すと自動同期値へ戻ります。'},
  payment_received_on:{mode:'mixed',source:'銀行CSVの実取引日、またはこの台帳で入力',note:'銀行照合時は明細の取引日を自動反映します。手入力を消すと銀行の最新取引日へ戻ります。'},
  accounting_month:{mode:'mixed',source:'見積システム ＞ 基本情報 ＞ 計上月。台帳でも変更可能'},
  customer_name:{mode:'auto',source:'見積システム ＞ 基本情報 ＞ 客先名／取引先マスタ'},
  customer_contact_name:{mode:'auto',source:'見積システム ＞ 基本情報 ＞ 得意先担当者'},
  sales_estimate_ex_tax:{mode:'auto',source:'見積システム ＞ 見積タブ ＞ 見積合計（税抜）'},
  landlord_burden_ex_tax:{mode:'auto',source:'見積システム ＞ 見積明細 ＞ 貸主負担額（税抜）'},
  tenant_burden_ex_tax:{mode:'auto',source:'見積システム ＞ 見積明細 ＞ 借主負担額（税抜）'},
  sales_invoice_tax_in:{mode:'auto',source:'見積システム ＞ 請求タブ ＞ 発行日確定時の請求合計（税込）'},
  parking_expense:{mode:'manual',source:'駐車場などの実費をこの台帳で入力'},
  fee_amount:{mode:'auto',source:'見積システム ＞ 請求タブ ＞ 紹介料・手数料'},
  closing_sales_accounting_month:{mode:'manual',source:'締め後に繰り越す売上計上月をこの台帳で選択'},
  accounting_year:{mode:'mixed',source:'請求日（未請求時は完工日・完工予定日・受付日）から9月始まりで自動計算',note:'9月1日から翌年8月31日までを同じ計上年度として扱います。例外時は担当者がプルダウンで補正でき、変更日時と変更者は操作履歴に残ります。'},
  client_name:{mode:'auto',source:'見積システム ＞ 請求タブ ＞ 請求先名'},
  customer_invoice_amount:{mode:'auto',source:'見積システム ＞ 請求タブ ＞ 請求合計（税抜）'},
  sales_invoice_ex_tax:{mode:'auto',source:'見積システム ＞ 請求タブ ＞ 請求合計（税抜）'},
  gross_profit_ex_tax:{mode:'calc',source:'売上（請求・税抜）－原価－紹介料・手数料',note:'会議用の粗利です。見積システムから連携される売上・原価・紹介料を基に自動計算します。'},
  gross_profit_rate:{mode:'calc',source:'粗利 ÷ 売上（請求・税抜）',note:'会議用の粗利率です。売上が未入力の場合は 0.0% と表示します。'},
  received_checked:{mode:'manual',source:'入金確認後、この台帳でチェック'},
  received_amount:{mode:'mixed',source:'銀行CSV照合額、またはこの台帳で入力',note:'手入力を優先します。手入力を空欄へ戻すと銀行照合額が自動復活します。'},
  outstanding_amount:{mode:'calc',source:'客先請求額－入金額'},
  external_cost:{mode:'auto',source:'見積システム ＞ 売上原価管理表 ＞ 原価合計（税抜）'},
  external_paid_checked:{mode:'manual',source:'外注費の支払確認後、この台帳でチェック'}
};
const LEDGER_TO_ESTIMATE_BLANK_FIELDS=new Set([
  'reception_date','staff_name','work_name','scheduled_completion_date','completed_on',
  'accounting_month','customer_name','customer_contact_name','notes'
]);
// ↗ は「編集できる実際の入力元」が一意にある列だけに表示する。
// 台帳内だけで完結する列や、複数の経路を持つ列へは誤案内しない。
const ESTIMATE_JUMP_FIELDS=new Set([
  'reception_date','input_date','staff_name','property_name','property_room','work_name',
  'scheduled_completion_date','completed_on','accounting_month','customer_name','customer_contact_name',
  'category','vendor_name','estimate_amount_ex_tax','invoice_amount_ex_tax',
  'sales_estimate_ex_tax','landlord_burden_ex_tax','tenant_burden_ex_tax',
  'invoice_to_customer_date','invoice_date','client_name','customer_invoice_amount',
  'sales_invoice_ex_tax','sales_invoice_tax_in','fee_amount','external_cost'
]);
function initSourceGuide(){
  if($('sourceGuide'))return;
  document.body.insertAdjacentHTML('beforeend',`
    <aside id="sourceGuide" class="source-guide">
      <div id="guideHandle" class="guide-head"><span>入力元ヒント</span><button type="button" onclick="toggleSourceGuide()">折りたたむ</button></div>
      <div class="guide-body">
        <div id="guideField" class="guide-field">セルを選択してください</div>
        <div><span id="guideBadge" class="guide-badge">自動連携</span></div>
        <div id="guideSource" class="guide-source">選択したセルの入力元をここに表示します。</div>
        <div id="guideNote" class="guide-note">薄い黄色は未入力です。入力済みセルは白で表示します。</div>
        <div id="guideActions" class="guide-actions"></div>
      </div>
    </aside>`);
  document.body.insertAdjacentHTML('beforeend','<div id="quickHint" class="quick-hint" role="status" aria-live="polite"></div>');
  const guide=$('sourceGuide'),handle=$('guideHandle');
  let savedGuide={};
  try{savedGuide=JSON.parse(localStorage.getItem('ledgerSourceGuide')||'{}')}catch(_error){savedGuide={}}
  if(savedGuide.collapsed)guide.classList.add('collapsed');
  if(Number.isFinite(savedGuide.left)&&Number.isFinite(savedGuide.top)){
    guide.style.right='auto';guide.style.bottom='auto';
    guide.style.left=`${Math.max(4,Math.min(window.innerWidth-170,savedGuide.left))}px`;
    guide.style.top=`${Math.max(4,Math.min(window.innerHeight-44,savedGuide.top))}px`;
  }
  guide.querySelector('.guide-head button').textContent=guide.classList.contains('collapsed')?'開く':'折りたたむ';
  let drag=null;
  handle.addEventListener('pointerdown',event=>{
    if(event.target.closest('button'))return;
    const rect=guide.getBoundingClientRect();
    drag={x:event.clientX,y:event.clientY,left:rect.left,top:rect.top};
    guide.style.right='auto';guide.style.bottom='auto';
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointermove',event=>{
    if(!drag)return;
    const left=Math.max(4,Math.min(window.innerWidth-guide.offsetWidth-4,drag.left+event.clientX-drag.x));
    const top=Math.max(4,Math.min(window.innerHeight-guide.offsetHeight-4,drag.top+event.clientY-drag.y));
    guide.style.left=`${left}px`;guide.style.top=`${top}px`;
  });
  handle.addEventListener('pointerup',()=>{
    drag=null;
    const rect=guide.getBoundingClientRect();
    localStorage.setItem('ledgerSourceGuide',JSON.stringify({left:rect.left,top:rect.top,collapsed:guide.classList.contains('collapsed')}));
  });
}
function updateQuickHint(fieldKey,cell){
  const hint=$('quickHint');
  if(!hint)return;
  const messages={
    reminder_required:'<b>要確認</b>は、社内メモ兼・色分けです。確認が済んだらチェックを外します。',
    invoice_amount_ex_tax:'<b>請求金額</b>は、外注請求書を見て入力する金額です（得意先への請求額ではありません）。',
    meeting_checked:'<b>翌月へ繰越</b>をチェックすると、今月の集計から外して翌月へ送ります。繰越先の月では薄紫で表示します。',
    meeting_month:'<b>会議月度</b>は、この案件を集計する月です。元の計上月から変更した案件は薄紫で表示します。',
    accounting_year:'<b>計上年度</b>は通常、日付から自動で決まります。例外時だけ変更してください。変更日時と変更者は操作履歴に残ります。'
  };
  const message=messages[fieldKey];
  clearTimeout(quickHintTimer);
  if(!message||!cell){hint.classList.remove('show');return;}
  hint.innerHTML=`<span>💡</span><div>${message}</div>`;
  const rect=cell.getBoundingClientRect();
  const left=Math.max(10,Math.min(window.innerWidth-350,rect.right-330));
  const top=Math.max(10,Math.min(window.innerHeight-96,rect.bottom+8));
  hint.style.left=`${left}px`;
  hint.style.top=`${top}px`;
  hint.classList.add('show');
  quickHintTimer=setTimeout(()=>hint.classList.remove('show'),6500);
}
function toggleSourceGuide(){
  const guide=$('sourceGuide');
  guide.classList.toggle('collapsed');
  guide.querySelector('.guide-head button').textContent=guide.classList.contains('collapsed')?'開く':'折りたたむ';
  const rect=guide.getBoundingClientRect();
  localStorage.setItem('ledgerSourceGuide',JSON.stringify({left:rect.left,top:rect.top,collapsed:guide.classList.contains('collapsed')}));
}
function guideEstimateTab(fieldKey){
  if(['category','vendor_name','estimate_amount_ex_tax','invoice_amount_ex_tax','invoice_from_vendor_date','payment_date','payment_month','external_cost','external_paid_checked','variance_ex_tax','reminder_required'].includes(fieldKey))return 'order';
  if(['invoice_to_customer_date','invoice_date','billing_client_name','client_name','customer_invoice_amount','sales_invoice_ex_tax','sales_invoice_tax_in','fee_amount'].includes(fieldKey))return 'invoice';
  if(['completed_on'].includes(fieldKey))return 'report';
  return 'basic';
}
function guideManagementNumber(cell){
  return cell?.closest('tr')?.querySelector('[data-field="management_number"]')?.value?.trim()||'';
}
function guideEstimateUrl(){
  const fieldKey=guideTargetCell.querySelector('[data-field]')?.dataset.field||'';
  const url=new URL('estimate.html',location.href);
  const managementNumber=guideManagementNumber(guideTargetCell);
  if(managementNumber)url.searchParams.set('management_number',managementNumber);
  url.searchParams.set('open_tab',guideEstimateTab(fieldKey));
  url.searchParams.set('focus_field',fieldKey);
  return url.href;
}
function editGuideCell(){
  if(!guideTargetCell)return;
  const input=guideTargetCell.querySelector('[data-field]');
  if(!input||input.disabled||input.readOnly)return;
  if(input.dataset.type==='date')return openLedgerDatePicker(input);
  input.focus();
  if(typeof input.select==='function'&&input.type!=='checkbox')input.select();
}
function updateSourceGuide(fieldKey,cell=null){
  const field=config.fields.find(item=>item.key===fieldKey);
  if(!field)return;
  if(cell)guideTargetCell=cell;
  updateQuickHint(fieldKey,cell);
  const linkedByDefault=!field.computed&&!['checkbox','date','month'].includes(field.type)&&!field.key.includes('notes')&&!field.key.includes('memo');
  const guide=fieldGuides[fieldKey]||{
    mode:field.computed?'calc':field.locked||linkedByDefault?'auto':'manual',
    source:field.computed?'同じ行の関連セルから自動計算':field.locked||linkedByDefault?`見積システムまたは管理番号台帳 ＞ ${field.label.replace(/<br>/g,' ')}`:'この台帳で直接入力',
    note:field.computed?'元になるセルを変更すると自動で再計算します。':field.locked||linkedByDefault?'見積システムの案件保存時に自動同期します。該当項目が未入力の場合は見積システム側を確認してください。':'この台帳で入力・上書きできます。'
  };
  const labels={auto:'自動連携',manual:'台帳入力',calc:'自動計算',mixed:'自動連携＋上書き'};
  $('guideField').textContent=field.label.replace(/<br>/g,' ');
  $('guideBadge').textContent=labels[guide.mode]||labels.manual;
  $('guideBadge').className=`guide-badge ${guide.mode==='manual'||guide.mode==='mixed'?'manual':guide.mode==='calc'?'calc':''}`;
  $('guideSource').textContent=guide.source;
  $('guideNote').textContent=guide.note||'薄い黄色は未入力です。入力済みセルは白で表示します。手入力を消すと、自動連携値がある項目は元の値へ戻ります。';
  const actions=$('guideActions');
  if(!actions)return;
  const isEditable=guideTargetCell?.querySelector('[data-field]')&&!field.computed&&!field.locked;
  if(guide.mode==='auto'||guide.mode==='mixed'){
    const estimateUrl=guideTargetCell?guideEstimateUrl():'estimate.html';
    actions.innerHTML=`<a class="guide-primary" href="${esc(estimateUrl)}">見積システムの入力元を開く →</a>${isEditable?'<button type="button" onclick="editGuideCell()">このセルを直接入力</button>':''}`;
  }else if(guide.mode==='manual'&&isEditable){
    actions.innerHTML='<button type="button" class="guide-primary" onclick="editGuideCell()">このセルを入力する</button>';
  }else{
    actions.innerHTML='';
  }
}

function canViewMeeting(email){
  return meetingAccessAllowed||MEETING_USERS_FALLBACK.has(String(email||'').toLowerCase());
}
async function refreshMeetingAccess(user){
  const email=String(user?.email||'').toLowerCase();
  const {data,error}=await db.rpc('can_view_meeting');
  meetingAccessAllowed=error?MEETING_USERS_FALLBACK.has(email):data===true;
  return meetingAccessAllowed;
}
function injectMeetingLink(){
  const nav=document.querySelector('#userBox .nav');
  if(!nav)return;
  nav.querySelectorAll('.meeting-link,.calendar-link,.audit-link,.account-link,.admin-link,.backup-link').forEach(link=>link.remove());
  let estimateLink=[...nav.querySelectorAll('a')].find(link=>new URL(link.href,location.href).pathname.endsWith('/estimate.html'));
  if(!estimateLink){
    nav.insertAdjacentHTML('afterbegin',`<a href="estimate.html">見積を開く</a>`);
    estimateLink=nav.querySelector('a[href$="estimate.html"]');
  }
  estimateLink.classList.add('estimate-header-link');
  estimateLink.title='新しい見積をオンライン見積システムで作成します';
  nav.insertAdjacentHTML('afterbegin',`<a class="calendar-link" href="calendar.html" title="受付・現地予定を登録し、見積作成へつなげます">カレンダー</a>`);
  nav.insertAdjacentHTML('beforeend',`<a class="audit-link" href="操作履歴.html" title="誰がいつ何を変更したか確認します">操作履歴</a>`);
  nav.insertAdjacentHTML('beforeend',`<a class="account-link" href="ユーザー設定.html" title="表示名・パスワードを変更します">ユーザー設定</a>`);
  if(isAdmin){
    nav.insertAdjacentHTML('beforeend',`<a class="admin-link" href="システム管理.html" title="社員の利用許可・権限・招待を管理します">システム管理</a><a class="backup-link" href="バックアップ管理.html" title="週次バックアップと復旧データを管理します">バックアップ</a>`);
  }
  if(canViewMeeting(currentUser?.email)){
    nav.insertAdjacentHTML('beforeend',`<a class="meeting-link" href="会議用案件一覧.html">会議案件</a><a class="meeting-link" href="経営会議資料.html">経営会議</a>`);
  }
  const current=decodeURIComponent(location.pathname.split('/').pop()||'');
  nav.querySelectorAll('a').forEach(link=>{
    const target=decodeURIComponent(new URL(link.href,location.href).pathname.split('/').pop()||'');
    link.classList.toggle('current',target===current);
  });
}

function initLoginHelp(){
  const loginCard=$('loginCard');
  if(!loginCard||loginCard.querySelector('.login-links'))return;
  const heading=loginCard.querySelector('h2');
  const introduction=heading?.nextElementSibling;
  if(introduction&&!introduction.matches('label,input,button')){
    introduction.textContent='見積・発注・原価・請求・各台帳・予定カレンダーで共通の社員アカウントです。登録済みの会社メールアドレスと、ご自身で設定したパスワードを入力してください。';
  }
  const next=encodeURIComponent(location.pathname+location.search);
  const status=$('loginStatus');
  const mount=status||loginCard.lastElementChild;
  mount?.insertAdjacentHTML('beforebegin',`
    <div class="login-links">
      <a href="auth.html?mode=signup&next=${next}">初回登録</a>
      <span>・</span>
      <a href="auth.html?mode=forgot&next=${next}">パスワードを忘れた方</a>
    </div>
  `);
}

function quickFilterOptions(){
  if(config.viewKey==='meeting')return [
    ['all','すべて'],['received','入金済み'],['unreceived','未入金'],['missing','未入力あり']
  ];
  if(config.viewKey==='billing')return [
    ['all','すべて'],['outstanding','未入金リスト'],['paid','入金済み'],['missing','未入力あり']
  ];
  if(config.viewKey==='cost')return [
    ['all','すべて'],['vendorInvoiceMissing','外注請求未入力'],['negativeVariance','差異がマイナス'],['missing','未入力あり']
  ];
  if(config.viewKey==='unordered')return [
    ['all','すべて'],['missing','未入力あり']
  ];
  return [
    ['all','すべて'],['notInvoiced','請求書未作成'],['missing','未入力あり']
  ];
}

function initAdvancedControls(){
  if($('quickFilter'))return;
  const toolbar=document.querySelector('.toolbar');
  const zoomField=toolbar?.querySelector('.field.zoom');
  if(!toolbar||!zoomField)return;
  zoomField.insertAdjacentHTML('afterend',`
    ${config.viewKey==='meeting'?`<div class="field meeting-month-filter"><label>会議月度</label><select id="meetingMonthFilter"><option value="">すべて</option>${monthOptions.slice(1).map(value=>`<option value="${value}">${value}</option>`).join('')}</select></div>`:''}
    <div class="field staff-filter"><label>工事担当者</label><select id="staffFilter"><option value="">社員マスタから選択</option></select></div>
    <div class="field quick-filter"><label>絞り込み</label><select id="quickFilter">${quickFilterOptions().map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></div>
  `);
  const controls=document.querySelector('.controls');
  const status=$('ledgerStatus');
  controls.insertAdjacentHTML('beforeend',`
    <div class="status-row">
      <div id="statusMount"></div>
      ${pageSize>0?`<nav id="pager" class="pager" aria-label="台帳ページ">
        <button id="firstPage" type="button" aria-label="最初のページ">≪</button>
        <button id="prevPage" type="button" aria-label="前のページ">‹</button>
        <span id="pageLabel" class="page-label">1 / 1</span>
        <button id="nextPage" type="button" aria-label="次のページ">›</button>
        <button id="lastPage" type="button" aria-label="最後のページ">≫</button>
      </nav>`:``}
    </div>
  `);
  $('statusMount').append(status);
  if(pageSize>0){
    $('firstPage').addEventListener('click',()=>setPage(1));
    $('prevPage').addEventListener('click',()=>setPage(currentPage-1));
    $('nextPage').addEventListener('click',()=>setPage(currentPage+1));
    $('lastPage').addEventListener('click',()=>setPage(totalPages()));
  }
  const tableWrap=document.querySelector('.table-wrap');
  if(pageSize<=0&&tableWrap&&!tableWrap.dataset.continuousRowsBound){
    tableWrap.dataset.continuousRowsBound='1';
    tableWrap.addEventListener('scroll',()=>{
      if(continuousScrollFrame)return;
      continuousScrollFrame=requestAnimationFrame(()=>{
        continuousScrollFrame=0;
        const remaining=tableWrap.scrollHeight-tableWrap.scrollTop-tableWrap.clientHeight;
        if(remaining>Math.max(500,tableWrap.clientHeight*.6)||continuousRenderedCount>=viewRows.length)return;
        continuousRenderedCount=Math.min(viewRows.length,continuousRenderedCount+continuousBatchSize);
        renderTable();
        updateResultStatus();
      });
    },{passive:true});
  }
  $('staffFilter').addEventListener('change',()=>applyView(true));
  $('quickFilter').addEventListener('change',()=>applyView(true));
  if($('meetingMonthFilter')){
    const requestedMonth=new URL(location.href).searchParams.get('month');
    $('meetingMonthFilter').value=requestedMonth&&monthOptions.includes(`${Number(requestedMonth)}月`)
      ?`${Number(requestedMonth)}月`
      :`${new Date().getMonth()+1}月`;
    $('meetingMonthFilter').addEventListener('change',()=>applyView(true));
  }
  const requestedFilter=new URL(location.href).searchParams.get('filter');
  if(requestedFilter&&[...$('quickFilter').options].some(option=>option.value===requestedFilter)){
    $('quickFilter').value=requestedFilter;
  }
}

function hasMissingValue(values){
  return config.fields.some(field=>!field.computed&&!field.optional&&field.type!=='checkbox'&&isEmptyField(field,values[field.key]));
}
function matchesQuickFilter(values){
  const filter=$('quickFilter')?.value||'all';
  if(filter==='all')return true;
  if(filter==='meeting')return Boolean(values.meeting_checked);
  if(filter==='missing')return hasMissingValue(values);
  if(filter==='notInvoiced')return !values.invoice_date;
  if(filter==='outstanding')return numberValue(values.outstanding_amount)>0;
  if(filter==='paid')return Boolean(values.received_checked)||numberValue(values.outstanding_amount)<=0;
  if(filter==='received')return Boolean(values.received_checked);
  if(filter==='unreceived')return !Boolean(values.received_checked);
  if(filter==='vendorInvoiceMissing')return !numberValue(values.invoice_amount_ex_tax);
  if(filter==='negativeVariance')return numberValue(values.variance_ex_tax)<0;
  return true;
}

function totalPages(){
  if(pageSize<=0)return 1;
  return Math.max(1,Math.ceil(viewRows.length/pageSize));
}
function pageRows(){
  if(pageSize<=0)return viewRows.slice(0,continuousRenderedCount);
  const start=(currentPage-1)*pageSize;
  return viewRows.slice(start,start+pageSize);
}
function flushDirtyRows(){
  const keys=[...new Set([...document.querySelectorAll('#ledgerBody tr.dirty[data-key]')].map(row=>row.dataset.key))];
  return Promise.all(keys.map(key=>saveRow(key)));
}
function setPage(page){
  flushDirtyRows();
  currentPage=Math.max(1,Math.min(totalPages(),page));
  renderTable();
  updatePager();
  updateResultStatus();
  activeCell=null;
  selectionFocus=null;
  if($('selectionSum'))$('selectionSum').textContent='0セル　合計 ¥0';
  document.querySelector('.table-wrap')?.scrollTo({top:0,left:0,behavior:'smooth'});
}
function updatePager(){
  if(!$('pager'))return;
  const pager=$('pager');
  pager.classList.toggle('hidden',pageSize<=0);
  if(pageSize<=0)return;
  const pages=totalPages();
  currentPage=Math.max(1,Math.min(pages,currentPage));
  const start=viewRows.length?(currentPage-1)*pageSize+1:0;
  const end=Math.min(currentPage*pageSize,viewRows.length);
  $('pageLabel').textContent=`${currentPage} / ${pages}（${start}–${end}件）`;
  $('firstPage').disabled=currentPage<=1;
  $('prevPage').disabled=currentPage<=1;
  $('nextPage').disabled=currentPage>=pages;
  $('lastPage').disabled=currentPage>=pages;
}
function updateResultStatus(){
  if(pageSize<=0){
    const rendered=Math.min(continuousRenderedCount,viewRows.length);
    setStatus(`全${viewRows.length.toLocaleString()}件を連続表示（現在${rendered.toLocaleString()}件を描画 / 下へスクロールで続き）`);
    return;
  }
  const start=viewRows.length?(pageSize<=0?1:(currentPage-1)*pageSize+1):0;
  const end=pageSize<=0?viewRows.length:Math.min(currentPage*pageSize,viewRows.length);
  setStatus(`${start}〜${end}件を表示 / 絞り込み${viewRows.length.toLocaleString()}件 / 全${allRows.length.toLocaleString()}件`);
}

function setStatus(text,error=false){
  $('ledgerStatus').textContent=text;
  $('ledgerStatus').className='status'+(error?' error':'');
}
function normalizeMonth(value){
  if(value===null||value===undefined||value==='')return '';
  const text=String(value);
  const dateMatch=text.match(/^\d{4}[-/](\d{1,2})/);
  if(dateMatch)return `${Number(dateMatch[1])}月`;
  const match=text.match(/\d{1,2}/);
  return match?`${Number(match[0])}月`:'';
}
function nullableDate(value){
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value||''))?value:'';
}
function accountingYearForDate(value){
  if(fiscalYearCore)return fiscalYearCore.accountingYearForDate(value);
  const match=String(value||'').match(/^(\d{4})[-/](\d{1,2})/);
  if(!match)return'';
  const year=Number(match[1]),month=Number(match[2]);
  return `${month>=9?year:year-1}年度`;
}
function projectAccountingYear(project){
  return project.accounting_year||accountingYearForDate(
    project.invoice_date||project.completed_on||project.scheduled_completion_date||project.reception_date
  );
}
function categoryFor(line){
  return line.category||line.raw_data?.category||(line.row_type==='discount'?'値引き':'外注費');
}
function projectFor(id){
  return projectMap.get(id)||{};
}
function mergedRow(row){
  const manual=overrides.get(row.key)||{};
  const values={meeting_checked:false,...row.auto,...manual};
  if(config.viewKey==='cost'||config.viewKey==='unordered'){
    values.variance_ex_tax=numberValue(values.invoice_amount_ex_tax)-numberValue(values.estimate_amount_ex_tax);
  }
  if(config.viewKey==='billing'){
    values.outstanding_amount=numberValue(values.customer_invoice_amount)-numberValue(values.received_amount);
  }
  if(config.viewKey==='meeting'){
    // 旧「会議用」チェックだけが残るデータは繰越にはしない。
    // 会議月度が元月度と異なることを唯一の繰越判定にして、表示と集計を一致させる。
    values.meeting_checked=Boolean(meetingPeriod?.isMoved(row.auto.meeting_month,values.meeting_month));
    values.gross_profit_ex_tax=numberValue(values.sales_invoice_ex_tax)-numberValue(values.external_cost)-numberValue(values.fee_amount);
    values.gross_profit_rate=numberValue(values.sales_invoice_ex_tax)
      ?values.gross_profit_ex_tax/numberValue(values.sales_invoice_ex_tax)*100
      :0;
  }
  return {...row,manual,values};
}
function rowVisualClass(merged){
  const project=projectFor(merged.projectId);
  if(config.viewKey==='meeting'&&meetingPeriod?.isMoved(merged.auto.meeting_month,merged.values.meeting_month)){
    return 'row-rollover';
  }
  if(config.viewKey==='cost'||config.viewKey==='unordered'){
    if(Boolean(merged.values.reminder_required))return 'row-reminder';
    const orderedLines=(merged.lines||[]).filter(line=>line.ordered===true);
    const vendorPaid=orderedLines.length>0&&orderedLines.every(line=>Boolean(line.supplier_paid)||line.line_status==='支払済');
    if(vendorPaid)return 'row-vendor-paid row-complete';
    if(merged.synthetic&&project.customer_payment_status==='入金済'&&(project.vendor_payment_status==='支払済'||numberValue(project.external_cost_ex_tax)===0)){
      return 'row-complete';
    }
    return '';
  }
  const customerPaid=project.customer_payment_status==='入金済'||Boolean(project.payment_received_on)||Boolean(merged.values.received_checked);
  if(config.viewKey==='billing'&&!customerPaid&&numberValue(merged.values.outstanding_amount)>0
    &&window.IzumiLedgerDates?.isAtLeastMonthsOld(merged.values.invoice_date,3)){
    return 'row-overdue';
  }
  const vendorRequired=numberValue(project.external_cost_ex_tax)>0||project.vendor_payment_status!=='未発注';
  const vendorPaid=project.vendor_payment_status==='支払済'||!vendorRequired;
  if(customerPaid&&vendorPaid)return 'row-customer-paid row-vendor-paid row-complete';
  if(customerPaid)return 'row-customer-paid';
  if(vendorRequired&&vendorPaid)return 'row-vendor-paid';
  return '';
}
function buildManagementRows(){
  return projects.map(project=>({
    key:project.id,
    projectId:project.id,
    auto:{
      management_number:project.management_number||'',reception_date:nullableDate(project.reception_date),
      staff_name:project.staff_name||'',property_name:[project.property_name,project.room_number].filter(Boolean).join(' '),work_name:project.work_name||project.work_summary||'',
      scheduled_completion_date:nullableDate(project.scheduled_completion_date),completed_on:nullableDate(project.completed_on),
      invoice_date:nullableDate(project.invoice_date),
      customer_name:project.customer_name||project.client_name||'',customer_contact_name:project.customer_contact_name||project.invoice_contact_name||'',
      sales_estimate_ex_tax:project.sales_estimate_ex_tax,
      landlord_burden_ex_tax:project.landlord_burden_ex_tax??(project.landlord_burden_tax_in==null?'':Math.round(numberValue(project.landlord_burden_tax_in)/1.1)),
      tenant_burden_ex_tax:project.tenant_burden_ex_tax??(project.tenant_burden_tax_in==null?'':Math.round(numberValue(project.tenant_burden_tax_in)/1.1)),
      sales_invoice_tax_in:project.invoice_date?project.sales_invoice_tax_in:'',
      parking_expense:project.parking_expense,accounting_month:normalizeMonth(project.accounting_month),
      payment_received_on:nullableDate(project.payment_received_on),notes:project.notes||'',fee_amount:project.fee_amount,
      closing_sales_accounting_month:normalizeMonth(project.closing_sales_accounting_month),accounting_year:projectAccountingYear(project)
    }
  }));
}
function buildVendorGroups(){
  const groups=new Map();
  lineItems.filter(line=>line.document_type==='order'&&(line.item_name||line.vendor_name||numberValue(line.order_amount_ex_tax))).forEach(line=>{
    const project=projectFor(line.project_id);
    const vendor=line.vendor_name||'未割当';
    const category=categoryFor(line);
    const key=`${line.project_id}|${vendor}|${category}`;
    if(!groups.has(key))groups.set(key,{key,projectId:line.project_id,lines:[],project,vendor,category});
    groups.get(key).lines.push(line);
  });
  return [...groups.values()].map(group=>{
    const estimate=group.lines.reduce((sum,line)=>sum+numberValue(line.order_amount_ex_tax),0);
    const supplierInvoice=group.lines.reduce((sum,line)=>sum+numberValue(line.supplier_invoice_amount_ex_tax??line.raw_data?.supplierInvoiceAmount),0);
    const ordered=group.lines.some(line=>line.ordered===true);
    const supplierInvoiceDates=group.lines.map(line=>nullableDate(line.supplier_invoice_date)).filter(Boolean);
    const supplierPaymentDates=group.lines.map(line=>nullableDate(line.supplier_payment_date)).filter(Boolean);
    const payableLines=group.lines.filter(line=>line.ordered===true);
    const supplierPaid=payableLines.length>0&&payableLines.every(line=>Boolean(line.supplier_paid)||line.line_status==='支払済');
    const reminderRequired=group.lines.some(line=>Boolean(line.reminder_required));
    const note=[...new Set(group.lines.map(line=>line.note).filter(Boolean))].join(' / ');
    const project=group.project;
    return {
      key:group.key,projectId:group.projectId,lineItemId:group.lines[0]?.id||null,
      lineItemIds:group.lines.map(line=>line.id).filter(Boolean),lines:group.lines,ordered,
      auto:{
        management_number:project.management_number||'',input_date:nullableDate(project.reception_date),
        staff_name:project.staff_name||'',property_name:[project.property_name,project.room_number].filter(Boolean).join(' '),
        work_name:project.work_name||project.work_summary||'',category:group.category,vendor_name:group.vendor,
        estimate_amount_ex_tax:estimate,invoice_amount_ex_tax:supplierInvoice||'',
        variance_ex_tax:supplierInvoice-estimate,scheduled_completion_date:nullableDate(project.scheduled_completion_date),
        completed_on:nullableDate(project.completed_on),invoice_to_customer_date:nullableDate(project.invoice_date),
        invoice_from_vendor_date:supplierInvoiceDates.sort().at(-1)||'',
        payment_date:supplierPaymentDates.sort().at(-1)||'',
        payment_month:normalizeMonth(supplierPaymentDates.sort().at(-1)||''),
        external_paid_checked:supplierPaid,reminder_required:reminderRequired,notes:note,
        payment_received_on:nullableDate(project.payment_received_on),accounting_month:normalizeMonth(project.accounting_month)
      }
    };
  });
}
function buildUnassignedProjectRows(existingGroups){
  const groupedProjectIds=new Set(existingGroups.map(group=>group.projectId));
  return projects.filter(project=>!groupedProjectIds.has(project.id)).map(project=>({
    key:`${project.id}|未割当|未発注`,
    projectId:project.id,
    lineItemIds:[],
    ordered:false,
    synthetic:true,
    auto:{
      management_number:project.management_number||'',
      input_date:nullableDate(project.reception_date),
      staff_name:project.staff_name||'',
      property_name:[project.property_name,project.room_number].filter(Boolean).join(' '),
      work_name:project.work_name||project.work_summary||'',
      category:project.category||'',
      vendor_name:'未割当',
      estimate_amount_ex_tax:'',
      invoice_amount_ex_tax:'',
      variance_ex_tax:0,
      scheduled_completion_date:nullableDate(project.scheduled_completion_date),
      completed_on:nullableDate(project.completed_on),
      invoice_to_customer_date:nullableDate(project.invoice_date),
      invoice_from_vendor_date:'',
      payment_date:'',
      payment_month:'',
      notes:'',
      payment_received_on:nullableDate(project.payment_received_on),
      accounting_month:normalizeMonth(project.accounting_month)
    }
  }));
}
function buildBillingRows(){
  return projects.map(project=>{
    const invoice=numberValue(project.invoice_subtotal_ex_tax||project.sales_invoice_ex_tax||project.sales_estimate_ex_tax);
    const hasManualPaid=project.received_amount_ex_tax!==null&&project.received_amount_ex_tax!==undefined&&project.received_amount_ex_tax!=='';
    const paid=hasManualPaid?project.received_amount_ex_tax:
      (numberValue(project.bank_received_amount_ex_tax)>0?numberValue(project.bank_received_amount_ex_tax):'');
    return {
      key:project.id,projectId:project.id,
      auto:{
        management_number:project.management_number||'',accounting_month:normalizeMonth(project.accounting_month),
        property_room:[project.property_name,project.room_number].filter(Boolean).join(' '),
        client_name:project.billing_client_name||project.customer_name||project.client_name||'',
        invoice_date:nullableDate(project.invoice_date),customer_invoice_amount:invoice,
        received_checked:project.customer_payment_status==='入金済'||Boolean(project.payment_received_on),
        payment_received_on:nullableDate(project.payment_received_on),received_amount:paid,
        outstanding_amount:invoice-numberValue(paid),external_cost:numberValue(project.external_cost_ex_tax),
        external_paid_checked:project.vendor_payment_status==='支払済'
      }
    };
  });
}
function buildMeetingRows(){
  return projects.map(project=>{
    const sales=numberValue(project.invoice_subtotal_ex_tax||project.sales_estimate_ex_tax);
    return {
      key:project.id,projectId:project.id,
      auto:{
        management_number:project.management_number||'',
        property_room:[project.property_name,project.room_number].filter(Boolean).join(' '),
        staff_name:project.staff_name||'',
        meeting_checked:false,
        meeting_month:normalizeMonth(project.accounting_month||project.invoice_date||project.completed_on||project.scheduled_completion_date||project.reception_date),
        sales_invoice_ex_tax:sales,
        external_cost:numberValue(project.external_cost_ex_tax),
        fee_amount:numberValue(project.fee_amount),
        gross_profit_ex_tax:0,gross_profit_rate:0,
        received_checked:Boolean(project.payment_received_on),
        notes:project.notes||''
      }
    };
  });
}
function buildRows(){
  if(config.viewKey==='management')return buildManagementRows();
  if(config.viewKey==='billing')return buildBillingRows();
  if(config.viewKey==='meeting')return buildMeetingRows();
  const groups=buildVendorGroups();
  if(config.viewKey==='unordered')return [...groups.filter(group=>!group.ordered),...buildUnassignedProjectRows(groups)];
  return groups.filter(group=>group.ordered);
}
async function signIn(){
  $('loginStatus').textContent='ログイン中…';
  const {error}=await db.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});
  if(error)$('loginStatus').textContent=error.message;
  else await showApp();
}
async function signOut(){
  if(ledgerRealtimeChannel){
    await db.removeChannel(ledgerRealtimeChannel);
    ledgerRealtimeChannel=null;
  }
  await db.auth.signOut();
  location.reload();
}
function revealLogin(){
  const card=$('loginCard');
  if(card)card.classList.remove('hidden');
}
async function showApp(){
  if(appOpening)return;
  appOpening=true;
  try{
  // getSession() reads the cached session locally (no network round trip).
  // Server-side validity is still checked via the RPC calls below, so a
  // separate getUser() network call just to confirm the session exists is
  // unnecessary — that was one extra round trip on every page load.
  const {data:{session}}=await db.auth.getSession();
  const user=session?.user;
  if(!user){revealLogin();return}
  // These three checks don't depend on each other, so run them in parallel
  // instead of one after another — this is the main reason the login card
  // used to stay visible noticeably longer than necessary.
  const [{data:enabled,error:accessError},{data:meetingOk,error:meetingError},{data:adminData}]=await Promise.all([
    db.rpc('is_current_app_user_enabled'),
    db.rpc('can_view_meeting'),
    db.rpc('is_management_admin')
  ]);
  if(accessError||enabled!==true){
    $('loginStatus').textContent=accessError?'利用者設定を確認できません。管理者へ連絡してください。':'このアカウントは利用停止中です。管理者へ連絡してください。';
    await db.auth.signOut();
    revealLogin();
    return;
  }
  currentUser=user;
  meetingAccessAllowed=meetingError?MEETING_USERS_FALLBACK.has(String(user.email||'').toLowerCase()):meetingOk===true;
  if(config.viewKey==='meeting'&&!canViewMeeting(user.email)){
    $('loginStatus').textContent='この画面は経営会議メンバーのみ利用できます。';
    await db.auth.signOut();
    revealLogin();
    return;
  }
  isAdmin=adminData===true;
  $('loginCard').classList.add('hidden');
  $('app').classList.remove('hidden');
  $('userBox').classList.remove('hidden');
  $('userEmail').textContent=user.email;
  const heading=document.querySelector('header h1');
  if(heading&&!heading.querySelector('.version-badge'))heading.insertAdjacentHTML('beforeend',`<span class="version-badge">${APP_VERSION}</span>`);
  injectMeetingLink();
  initAdvancedControls();
  initSourceGuide();
  const help=document.querySelector('.excel-help');
  if(help)help.textContent='単クリック＝選択・ドラッグ＝範囲・Shift＝範囲拡張・⌘/Ctrl＝追加選択・ダブルクリック/Enter＝編集・⌘D＝下へコピー';
  updateSourceGuide(config.fields[0]?.key);
  await loadData();
  subscribeLedgerUpdates();
  }finally{
    appOpening=false;
  }
}
function scheduleLedgerReload(){
  clearTimeout(ledgerRealtimeTimer);
  ledgerRealtimeTimer=setTimeout(()=>{
    if(document.hidden)return;
    ledgerRealtimeTimer=null;
    loadData();
  },500);
}
function subscribeLedgerUpdates(){
  if(ledgerRealtimeChannel)return;
  ledgerRealtimeChannel=db.channel(`ledger-${config.viewKey}-${currentUser?.id||'user'}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'management_numbers'},scheduleLedgerReload)
    .subscribe();
}
async function fetchAll(table,{filter=null,order=null,batchSize=1000,maxRows=100000}={}){
  const collected=[];
  for(let from=0;from<maxRows;from+=batchSize){
    let query=db.from(table).select('*');
    if(filter)query=filter(query);
    if(order)query=query.order(order.column,{ascending:order.ascending??true});
    const {data,error}=await query.range(from,from+batchSize-1);
    if(error)return {data:collected,error};
    const rows=data||[];
    collected.push(...rows);
    if(rows.length<batchSize)return {data:collected,error:null};
  }
  return {data:collected,error:new Error(`${table} が ${maxRows.toLocaleString()}件を超えました。管理者へ連絡してください。`)};
}
async function fetchAllForProjectIds(table,projectIds,options={}){
  if(!projectIds.length)return {data:[],error:null};
  const chunks=[];
  for(let index=0;index<projectIds.length;index+=500)chunks.push(projectIds.slice(index,index+500));
  const results=await Promise.all(chunks.map(ids=>fetchAll(table,{
    ...options,filter:query=>{
      const scoped=query.in('project_id',ids);
      return options.filter?options.filter(scoped):scoped;
    }
  })));
  return {data:results.flatMap(result=>result.data||[]),error:results.find(result=>result.error)?.error||null};
}
async function loadData(){
  await flushDirtyRows();
  setStatus('読み込み中…');
  const needsLineItems=config.viewKey==='cost'||config.viewKey==='unordered';
  // 通常利用は当年度だけを取得する。更新のたびに過去5年分を全件読み直すと、
  // 案件数が増えた環境で入力中の画面まで重くなるためである。
  const selectedYear=$('yearFilter')?.value||currentFiscalCode();
  loadedLedgerYear=selectedYear;
  const projectResult=await fetchAll('management_numbers',{
    filter:query=>{
      const active=query.is('deleted_at',null);
      return selectedYear?active.like('management_number',`${selectedYear}-%`):active;
    },order:{column:'management_number',ascending:false}
  });
  const projectIds=(projectResult.data||[]).map(project=>project.id).filter(Boolean);
  const [lineResult,overrideResult,employeeResult]=await Promise.all([
    needsLineItems?fetchAllForProjectIds('project_line_items',projectIds,{filter:query=>query.is('deleted_at',null),order:{column:'id',ascending:true},maxRows:200000}):Promise.resolve({data:[],error:null}),
    fetchAllForProjectIds('project_manual_overrides',projectIds,{filter:query=>query.eq('view_key',config.viewKey),order:{column:'id',ascending:true}}),
    db.from('employee_master').select('*').eq('active',true).order('display_order',{ascending:true})
  ]);
  const firstError=projectResult.error||lineResult.error||overrideResult.error||employeeResult.error;
  if(firstError){
    setStatus(`${firstError.message}　「SUPABASE_UX16_統合更新.sql」の最新版をSupabaseで実行してください。`,true);
    return;
  }
  projects=projectResult.data||[];
  projectMap=new Map(projects.map(project=>[project.id,project]));
  lineItems=lineResult.data||[];
  employees=employeeResult.data||[];
  const staffNames=[...new Set([...projects.map(project=>project.staff_name).filter(Boolean),'林'])];
  staffNames.forEach((name,index)=>{
    if(!employees.some(employee=>employee.name===name))employees.push({name,display_order:900+index});
  });
  overrides=new Map((overrideResult.data||[]).map(item=>[item.row_key,item.field_values||{}]));
  overrideRevisions=new Map((overrideResult.data||[]).map(item=>[item.row_key,numberValue(item.revision)]));
  populateYearFilter();
  populateStaffFilter();
  allRows=buildRows();
  applyView(true);
  // UX42適用前に保存された「台帳上書き」を一度だけ正本へ救済する。
  // 以後は通常のsaveRowで即時に正本へ反映される。
  reconcilePendingLedgerWritebacks();
}
function currentFiscalCode(){
  if(fiscalYearCore)return fiscalYearCore.codeForDate(new Date());
  const today=new Date();
  const fiscalYear=today.getMonth()+1>=9?today.getFullYear()+1:today.getFullYear();
  return String(fiscalYear).slice(-2);
}
function populateYearFilter(){
  const select=$('yearFilter');
  const previous=loadedLedgerYear||select.value;
  const yearItems=fiscalYearCore
    ?fiscalYearCore.options({minimumCode:22,futureYears:3})
    :Array.from({length:Math.max(1,Number(currentFiscalCode())-21)},(_,index)=>{
      const code=String(Number(currentFiscalCode())-index).padStart(2,'0');
      return {code,label:`${1999+Number(code)}年度`};
    });
  const years=yearItems.map(item=>item.code);
  select.innerHTML='<option value="">すべて</option>'+yearItems.map(item=>`<option value="${esc(item.code)}">${esc(item.label)}</option>`).join('');
  const preferred=previous||currentFiscalCode();
  if(years.includes(preferred))select.value=preferred;
}
function populateStaffFilter(){
  const select=$('staffFilter');
  if(!select)return;
  const previous=select.value;
  const names=[...new Set([
    ...employees.map(employee=>employee.name),
    ...projects.map(project=>project.staff_name)
  ].filter(Boolean))].sort((left,right)=>String(left).localeCompare(String(right),'ja'));
  select.innerHTML='<option value="">社員マスタから選択</option>'+names.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('');
  if(names.includes(previous))select.value=previous;
}
function applyView(resetPage=false){
  flushDirtyRows();
  const year=$('yearFilter').value;
  const staff=$('staffFilter')?.value||'';
  const meetingMonth=$('meetingMonthFilter')?.value||'';
  const keyword=$('search').value.trim().toLowerCase();
  viewRows=allRows.filter(row=>{
    const merged=mergedRow(row);
    const yearMatch=!year||String(merged.values.management_number||'').startsWith(`${year}-`);
    const staffMatch=!staff||merged.values.staff_name===staff;
    const meetingMonthMatch=!meetingMonth||normalizeMonth(merged.values.meeting_month)===normalizeMonth(meetingMonth);
    const text=Object.values(merged.values).join(' ').toLowerCase();
    return yearMatch&&staffMatch&&meetingMonthMatch&&(!keyword||text.includes(keyword))&&matchesQuickFilter(merged.values);
  });
  viewRows.sort(compareRows);
  if(pageSize<=0)continuousRenderedCount=Math.min(continuousBatchSize,viewRows.length);
  if(resetPage)currentPage=1;
  currentPage=Math.max(1,Math.min(totalPages(),currentPage));
  renderTable();
  renderSummary();
  activeCell=null;
  selectionFocus=null;
  dragStart=null;
  dragging=false;
  checkboxBrush=null;
  updatePager();
  updateResultStatus();
}
function compareRows(left,right){
  const a=mergedRow(left).values[sortField]??'',b=mergedRow(right).values[sortField]??'';
  const field=config.fields.find(item=>item.key===sortField);
  const result=field?.type==='money'||field?.computed?numberValue(a)-numberValue(b):String(a).localeCompare(String(b),'ja',{numeric:true});
  return sortDirection==='asc'?result:-result;
}
function sortLedger(field){
  if(sortField===field)sortDirection=sortDirection==='asc'?'desc':'asc';
  else{sortField=field;sortDirection='asc'}
  applyView(false);
}
function clearSearch(){
  $('search').value='';
  if($('staffFilter'))$('staffFilter').value='';
  if($('quickFilter'))$('quickFilter').value='all';
  if($('meetingMonthFilter'))$('meetingMonthFilter').value='';
  applyView(true);
}
function shrinkClass(value){
  const length=String(value??'').length;
  return length>34?' shrink-3':length>24?' shrink-2':length>15?' shrink-1':'';
}
function optionsHtml(values,current){
  const options=[...values];
  if(current&&!options.includes(current))options.push(current);
  return options.map(value=>`<option value="${esc(value)}"${String(value)===String(current)?' selected':''}>${esc(value)}</option>`).join('');
}
function normalizeLedgerDate(value){
  const raw=String(value??'').trim();
  if(!raw)return '';
  const normalized=raw.replace(/[年月.]/g,'/').replace(/日/g,'').replace(/-/g,'/');
  const match=normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if(!match)return '';
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
  const date=new Date(year,month-1,day);
  if(date.getFullYear()!==year||date.getMonth()!==month-1||date.getDate()!==day)return '';
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}
function dateParts(value){
  const iso=normalizeLedgerDate(value);
  if(!iso)return null;
  const [year,month,day]=iso.split('-').map(Number);
  return {year,month,day};
}
function ensureLedgerDatePicker(){
  let picker=$('ledgerDatePicker');
  if(picker)return picker;
  document.body.insertAdjacentHTML('beforeend',`
    <div id="ledgerDatePicker" class="ledger-date-picker" hidden>
      <div class="ledger-date-head">
        <button type="button" data-action="prev" aria-label="前の月">‹</button>
        <strong id="ledgerDateTitle"></strong>
        <button type="button" data-action="next" aria-label="次の月">›</button>
      </div>
      <div class="ledger-date-week"><span>日</span><span>月</span><span>火</span><span>水</span><span>木</span><span>金</span><span>土</span></div>
      <div id="ledgerDateGrid" class="ledger-date-grid"></div>
      <div class="ledger-date-foot">
        <button type="button" data-action="clear">クリア</button>
        <button type="button" data-action="today">本日</button>
        <button type="button" data-action="close">閉じる</button>
      </div>
    </div>`);
  picker=$('ledgerDatePicker');
  picker.addEventListener('pointerenter',()=>clearTimeout(datePickerCloseTimer));
  picker.addEventListener('pointerleave',()=>scheduleLedgerDatePickerClose());
  picker.addEventListener('click',event=>{
    const dayButton=event.target.closest('[data-date]');
    if(dayButton){
      applyLedgerDate(dayButton.dataset.date);
      return;
    }
    const action=event.target.closest('[data-action]')?.dataset.action;
    if(!action)return;
    if(action==='prev'){datePickerMonth=new Date(datePickerMonth.getFullYear(),datePickerMonth.getMonth()-1,1);renderLedgerDatePicker();return}
    if(action==='next'){datePickerMonth=new Date(datePickerMonth.getFullYear(),datePickerMonth.getMonth()+1,1);renderLedgerDatePicker();return}
    if(action==='today'){const today=new Date();applyLedgerDate(`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`);return}
    if(action==='clear'){applyLedgerDate('');return}
    closeLedgerDatePicker();
  });
  document.addEventListener('pointerdown',event=>{
    if(!datePickerTarget||picker.hidden)return;
    if(event.target.closest('#ledgerDatePicker')||event.target.closest('.date-editor'))return;
    closeLedgerDatePicker();
  },true);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!picker.hidden)closeLedgerDatePicker();
  });
  window.addEventListener('scroll',closeLedgerDatePicker,true);
  return picker;
}
function renderLedgerDatePicker(){
  const picker=ensureLedgerDatePicker();
  if(!datePickerMonth)return;
  const year=datePickerMonth.getFullYear(),month=datePickerMonth.getMonth();
  $('ledgerDateTitle').textContent=`${year}年 ${month+1}月`;
  const firstDay=new Date(year,month,1).getDay();
  const lastDate=new Date(year,month+1,0).getDate();
  const selected=normalizeLedgerDate(datePickerTarget?.value);
  const today=new Date();
  const todayIso=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const cells=[];
  for(let index=0;index<firstDay;index++)cells.push('<span class="outside"></span>');
  for(let day=1;day<=lastDate;day++){
    const iso=`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    cells.push(`<button type="button" data-date="${iso}" class="${iso===selected?'selected ':''}${iso===todayIso?'today':''}">${day}</button>`);
  }
  $('ledgerDateGrid').innerHTML=cells.join('');
  picker.hidden=false;
}
function positionLedgerDatePicker(){
  const picker=ensureLedgerDatePicker();
  if(!datePickerTarget)return;
  const rect=datePickerTarget.closest('.date-editor')?.getBoundingClientRect()||datePickerTarget.getBoundingClientRect();
  const width=picker.offsetWidth||264,height=picker.offsetHeight||308;
  const left=Math.max(8,Math.min(window.innerWidth-width-8,rect.left));
  const below=rect.bottom+6;
  const top=below+height<=window.innerHeight-8?below:Math.max(8,rect.top-height-6);
  picker.style.left=`${left}px`;
  picker.style.top=`${top}px`;
}
function openLedgerDatePicker(input){
  if(!input||input.disabled||input.readOnly)return;
  clearTimeout(datePickerCloseTimer);
  datePickerTarget=input;
  const parts=dateParts(input.value);
  const base=parts?new Date(parts.year,parts.month-1,1):new Date();
  datePickerMonth=new Date(base.getFullYear(),base.getMonth(),1);
  renderLedgerDatePicker();
  requestAnimationFrame(positionLedgerDatePicker);
}
function scheduleLedgerDatePickerClose(){
  clearTimeout(datePickerCloseTimer);
  datePickerCloseTimer=setTimeout(closeLedgerDatePicker,220);
}
function closeLedgerDatePicker(){
  clearTimeout(datePickerCloseTimer);
  const picker=$('ledgerDatePicker');
  if(picker)picker.hidden=true;
  datePickerTarget=null;
}
function applyLedgerDate(value){
  if(!datePickerTarget)return;
  datePickerTarget.value=value;
  datePickerTarget.classList.remove('invalid-date');
  datePickerTarget.dispatchEvent(new Event('change',{bubbles:true}));
  datePickerTarget.focus({preventScroll:true});
  closeLedgerDatePicker();
}
function inputHtml(field,value){
  const display=field.type==='money'&&value!==''&&value!==null?formatNumber(value):field.type==='rate'?`${numberValue(value).toFixed(1)}%`:value??'';
  const classes=`${field.type==='money'?' money':''}${field.key==='management_number'?' number':''}${shrinkClass(display)}`;
  // セルの内容をそのまま繰り返すブラウザ標準ツールチップは表示しない。
  // title は日付ボタン・入力元矢印など、追加の説明が必要な操作だけに付与する。
  const attributes=`data-field="${field.key}" data-type="${field.type||'text'}"`;
  if(field.computed)return `<input class="${classes} computed" ${attributes} value="${esc(display)}" readonly>`;
  if(field.locked&&field.key==='management_number')return `<input class="${classes} management-number-link" ${attributes} value="${esc(display)}" readonly onclick="openEstimateOnline('${esc(display)}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openEstimateOnline('${esc(display)}')}" aria-label="管理番号 ${esc(display)} の保存済み見積を開く">`;
  if(field.locked)return `<input class="${classes}" ${attributes} value="${esc(display)}" disabled>`;
  if(field.type==='staff')return `<select class="${classes}" ${attributes}>${optionsHtml(['',...employees.map(employee=>employee.name)],display)}</select>`;
  if(field.type==='month')return `<select class="${classes}" ${attributes}>${optionsHtml(monthOptions,normalizeMonth(display))}</select>`;
  if(field.type==='fiscalYear')return `<select class="${classes}" ${attributes}>${optionsHtml(fiscalYearOptions,display)}</select>`;
  if(field.type==='checkbox')return `<input class="${classes}" ${attributes} type="checkbox"${Boolean(value)?' checked':''}>`;
  if(field.type==='date')return `<div class="date-editor"><input class="${classes} ledger-date-input" ${attributes} type="text" inputmode="numeric" autocomplete="off" placeholder="年/月/日" value="${esc(normalizeLedgerDate(display)||display)}"><button type="button" class="date-trigger" aria-label="カレンダーを開く" title="カレンダーを開く">▾</button></div>`;
  return `<input class="${classes}" ${attributes} type="text" value="${esc(display)}">`;
}
function isEmptyField(field,value){
  if(field.type==='checkbox'||field.computed||field.optional)return false;
  return value===undefined||value===null||String(value).trim()==='';
}
function estimateUpdateFields(merged){
  return config.fields.filter(field=>{
    const guide=fieldGuides[field.key];
    if(!guide||!['auto','mixed'].includes(guide.mode)||field.locked||field.computed)return false;
    if(!Object.hasOwn(merged.manual,field.key))return false;
    return !sameValue(merged.manual[field.key],merged.auto[field.key],field);
  });
}
function estimateUpdateBadge(merged){
  const fields=estimateUpdateFields(merged);
  if(!fields.length)return '';
  const labels=fields.map(field=>field.label.replace(/<br>/g,' ')).join('、');
  return `<span class="estimate-update-badge" title="台帳で「${esc(labels)}」を上書きしています。見積側に既存値があるため、自動では置き換えていません。">台帳上書き</span>`;
}
function estimateOpenLink(managementNumber){
  if(!managementNumber)return '';
  return `<button type="button" class="open-estimate-link" onclick="openEstimateOnline('${esc(managementNumber)}')" title="この管理番号のオンライン見積システムを開く">見積を開く</button>`;
}
function sourceJumpButton(field,row){
  const guide=fieldGuides[field.key];
  if(!guide||!ESTIMATE_JUMP_FIELDS.has(field.key)||field.locked||field.computed)return '';
  const managementNumber=row?.auto?.management_number||'';
  if(!managementNumber)return '';
  const lineIds=(row?.lineItemIds||[]).filter(Boolean).join(',');
  const label=`入力元を開く：${guide.source}`;
  return `<button type="button" class="source-jump" onclick="openEstimateSource(event,'${esc(managementNumber)}','${esc(field.key)}','${esc(lineIds)}')" aria-label="${esc(label)}" title="${esc(label)}">↗</button>`;
}
function openEstimateOnline(managementNumber){
  const url=new URL('estimate.html',location.href);
  url.searchParams.set('management_number',managementNumber);
  location.assign(url.href);
}
function openEstimateSource(event,managementNumber,fieldKey,lineIds=''){
  event?.preventDefault();
  event?.stopPropagation();
  const url=new URL('estimate.html',location.href);
  url.searchParams.set('management_number',managementNumber);
  url.searchParams.set('jump',fieldKey);
  if(lineIds)url.searchParams.set('line_ids',lineIds);
  const vendor=event?.currentTarget?.closest('tr')?.querySelector('[data-field="vendor_name"]')?.value||'';
  if(vendor)url.searchParams.set('jump_vendor',vendor);
  location.assign(url.href);
}
function setEmptyState(input){
  const cell=input?.closest('td[data-col]');
  if(!cell)return;
  const field=config.fields.find(item=>item.key===input.dataset.field);
  if(!field)return;
  const value=input.type==='checkbox'?input.checked:input.value;
  cell.classList.toggle('empty-cell',isEmptyField(field,value));
  cell.classList.toggle('warning-cell',Boolean(field.manualRequired)&&isEmptyField({...field,optional:false},value));
}
function markUserTouched(input){
  if(input?.dataset)input.dataset.userTouched='true';
}
function updateSheetHeight(visibleRowCount=viewRows.length){
  const sheet=document.querySelector('.sheet-area');
  if(!sheet)return;
  const rowCount=Math.max(1,Number(visibleRowCount||0));
  const contentHeight=rowCount*42+48;
  const sheetTop=sheet.getBoundingClientRect().top;
  const viewportHeight=Math.max(560,window.innerHeight-sheetTop-24);
  const desiredHeight=Math.min(Math.max(contentHeight,viewportHeight),1400);
  document.documentElement.style.setProperty('--sheet-height',`${Math.round(desiredHeight)}px`);
}
function renderTable(){
  const rows=pageRows();
  updateSheetHeight(rows.length);
  const deleteHead=config.allowDelete?'<th class="delete-head">削除</th>':'';
  $('ledgerHead').innerHTML=`<tr>${config.fields.map(field=>{
    const sticky=field.key==='meeting_checked'?' meeting-head':field.key==='management_number'?' number-head':'';
    return `<th class="${field.width||''}${sticky} field-${field.key}"><button class="sort${sortField===field.key?' active':''}" onclick="sortLedger('${field.key}')">${field.label}${sortField===field.key?(sortDirection==='asc'?' ▲':' ▼'):''}</button></th>`;
  }).join('')}${deleteHead}</tr>`;
  $('ledgerBody').innerHTML=rows.length?rows.map((row,rowIndex)=>{
    const merged=mergedRow(row);
    const cells=config.fields.map((field,colIndex)=>{
      const sticky=field.key==='meeting_checked'?' meeting-cell':field.key==='management_number'?' number-cell':'';
      const empty=isEmptyField(field,merged.values[field.key])?' empty-cell':'';
      const guideMode=(fieldGuides[field.key]?.mode||'manual').replace('mixed','auto');
      const guideClass=` guide-${guideMode}`;
      const manualRequired=field.manualRequired&&isEmptyField({...field,optional:false},merged.values[field.key])?' warning-cell':'';
      const warning=field.key==='outstanding_amount'&&numberValue(merged.values[field.key])>0?' warning-cell':'';
      const badge=field.key==='management_number'?estimateUpdateBadge(merged):'';
      const rolloverBadge=field.key==='meeting_month'&&meetingPeriod?.isMoved(merged.auto.meeting_month,merged.values.meeting_month)
        ?`<span class="rollover-badge" title="${esc(merged.auto.meeting_month||'元月度')}から${esc(merged.values.meeting_month)}へ繰越">繰越</span>`
        :'';
      const onlineLink=field.key==='management_number'?estimateOpenLink(merged.values[field.key]):'';
      const jumpButton=sourceJumpButton(field,row);
      return `<td data-row="${rowIndex}" data-col="${colIndex}" class="${field.width||''}${sticky}${empty}${guideClass}${manualRequired}${warning} field-${field.key}">${inputHtml(field,merged.values[field.key])}${rolloverBadge}${badge}${onlineLink}${jumpButton}</td>`;
    }).join('');
    const visualClass=rowVisualClass(merged);
    return `<tr data-key="${esc(row.key)}" data-row="${rowIndex}" class="${visualClass}">${cells}${deleteCell(row)}</tr>`;
  }).join(''):`<tr><td class="empty-state" colspan="${config.fields.length+(config.allowDelete?1:0)}">条件に一致するデータはありません。検索条件を解除してご確認ください。</td></tr>`;
  bindSheetEvents();
}
function deleteCell(){
  return config.allowDelete?'<td class="delete-cell"><button class="delete" onclick="deleteLedgerRow(this)">削除</button></td>':'';
}
function meetingCheckedCount(){
  return viewRows.filter(row=>Boolean(mergedRow(row).values.meeting_checked)).length;
}
function renderSummary(){
  const definitions=config.summaries||[];
  $('summary').innerHTML=definitions.map(item=>{
    const value=item.type==='count'?viewRows.length:viewRows.reduce((sum,row)=>sum+numberValue(mergedRow(row).values[item.key]),0);
    return `<div class="sum-card"><span>${item.label}</span><b>${item.type==='count'?`${value}件`:money(value)}</b></div>`;
  }).join('')
    +`<div class="sum-card selection-summary"><span>選択範囲</span><b id="selectionSum">0セル　合計 ¥0</b></div>`
    +(config.viewKey==='meeting'?`<div class="sum-card meeting-summary"><span>翌月繰越</span><b id="meetingCheckedSum">${meetingCheckedCount()}件</b></div>`:'');
}
function meetingSourceRow(row){
  return allRows.find(item=>String(item.key)===String(row?.dataset?.key));
}
function syncMeetingRolloverControls(row,changedField){
  if(config.viewKey!=='meeting'||!row||!meetingPeriod)return;
  const source=meetingSourceRow(row);
  const base=meetingPeriod.normalizeMonth(source?.auto?.meeting_month);
  const checkbox=row.querySelector('[data-field="meeting_checked"]');
  const monthSelect=row.querySelector('[data-field="meeting_month"]');
  if(!base||!checkbox||!monthSelect)return;
  if(changedField==='meeting_checked'){
    monthSelect.value=checkbox.checked?`${meetingPeriod.nextMonth(base)}月`:`${base}月`;
    markUserTouched(monthSelect);
    setEmptyState(monthSelect);
  }else if(changedField==='meeting_month'){
    checkbox.checked=meetingPeriod.isMoved(base,monthSelect.value);
    markUserTouched(checkbox);
    setEmptyState(checkbox);
  }
  row.classList.toggle('row-rollover',meetingPeriod.isMoved(base,monthSelect.value));
}
function bindSheetEvents(){
  document.querySelectorAll('#ledgerBody input,#ledgerBody select').forEach(input=>{
    if(input.disabled||input.readOnly)return;
    const changed=()=>{
      const row=input.closest('tr');
      markUserTouched(input);
      setEmptyState(input);
      row.classList.add('dirty');
      if(input.dataset.field==='reminder_required')row.classList.toggle('row-reminder',input.checked);
      if(input.dataset.field==='meeting_checked'||input.dataset.field==='meeting_month'){
        syncMeetingRolloverControls(row,input.dataset.field);
      }
      updateComputed(row);
      queueRowSave(row.dataset.key);
    };
    if(input.dataset.type==='date'){
      const editor=input.closest('.date-editor');
      editor?.addEventListener('pointerenter',()=>clearTimeout(datePickerCloseTimer));
      editor?.addEventListener('pointerleave',()=>scheduleLedgerDatePickerClose());
      input.addEventListener('input',()=>{
        markUserTouched(input);
        setEmptyState(input);
        input.closest('tr').classList.add('dirty');
      });
      input.addEventListener('change',changed);
      input.addEventListener('blur',()=>{
        const normalized=normalizeLedgerDate(input.value);
        input.classList.toggle('invalid-date',Boolean(input.value&&!normalized));
        if(normalized&&input.value!==normalized)input.value=normalized;
        if(!input.classList.contains('invalid-date'))queueRowSave(input.closest('tr').dataset.key,80);
      });
      input.addEventListener('click',()=>openLedgerDatePicker(input));
    }else{
      input.addEventListener('input',changed);
      input.addEventListener('change',changed);
      input.addEventListener('blur',()=>queueRowSave(input.closest('tr').dataset.key,80));
    }
    input.addEventListener('focus',()=>{
      const cell=input.closest('td[data-col]');
      if(cell){
        activeCell={row:+cell.dataset.row,col:+cell.dataset.col};
        selectionFocus=activeCell;
        if(!cell.classList.contains('selected'))selectRectangle(activeCell,activeCell);
        updateSourceGuide(input.dataset.field,cell);
      }
    });
    input.addEventListener('keydown',event=>{
      if(event.key==='Enter'){
        event.preventDefault();
        input.blur();
        focusCell(+input.closest('td').dataset.row+1,+input.closest('td').dataset.col);
      }
    });
    if(input.type==='checkbox'){
      input.addEventListener('click',event=>{
        if(!Object.hasOwn(input.dataset,'pointerToggle'))return;
        event.preventDefault();
        event.stopPropagation();
        const value=input.dataset.pointerToggle==='true';
        delete input.dataset.pointerToggle;
        queueMicrotask(()=>{input.checked=value});
      });
    }
    if(input.dataset.type==='money'){
      input.addEventListener('focus',()=>input.value=String(input.value).replace(/,/g,''));
      input.addEventListener('blur',()=>{if(input.value!=='')input.value=formatNumber(input.value);updateComputed(input.closest('tr'))});
    }
  });
  document.querySelectorAll('#ledgerBody td[data-col]').forEach(cell=>{
    cell.addEventListener('mousedown',event=>{
      if(event.button!==0)return;
      const point={row:+cell.dataset.row,col:+cell.dataset.col};
      const field=config.fields[point.col];
      if(field)updateSourceGuide(field.key,cell);
      if(event.target.closest('.date-trigger')){
        event.preventDefault();
        event.stopPropagation();
        activeCell=point;
        selectionFocus=point;
        selectRectangle(point,point);
        openLedgerDatePicker(cell.querySelector('.ledger-date-input'));
        return;
      }
      if(event.target.matches('.ledger-date-input')){
        activeCell=point;
        selectionFocus=point;
        selectRectangle(point,point);
        return;
      }
      if(event.target.matches('select')){
        activeCell=point;
        selectionFocus=point;
        selectRectangle(point,point);
        return;
      }
      if(event.target.matches('input[type="checkbox"]')){
        event.preventDefault();
        if(event.shiftKey&&activeCell){
          dragStart=activeCell;
          selectionFocus=point;
          dragging=true;
          selectRectangle(activeCell,point);
          return;
        }
        if(event.metaKey||event.ctrlKey){
          activeCell=point;
          selectionFocus=point;
          cell.classList.toggle('selected');
          updateSelectionSummary();
          return;
        }
        // A plain click on a checkbox is just "toggle this row's flag" —
        // it deliberately does NOT touch activeCell/selectionFocus or the
        // 選択範囲 (cell-range sum) widget. Those track Excel-style numeric
        // cell selection; a checkbox has no numeric value to sum, so
        // routing it through selectRectangle() only produced a confusing
        // "1セル　数値0件　合計¥0" that then silently reset to 0 a moment
        // later once the row's own save round-tripped through realtime
        // and re-rendered the table. Shift-click/⌘-click below still use
        // the normal range-selection path, since those are deliberate
        // range-selection gestures that happen to start/land on a
        // checkbox cell.
        dragStart=point;
        checkboxBrush=!event.target.checked;
        event.target.dataset.pointerToggle=String(checkboxBrush);
        setCheckboxCell(cell,checkboxBrush);
        return;
      }
      if(event.detail>1){
        activeCell=point;
        selectionFocus=point;
        selectRectangle(point,point);
        return;
      }
      if(event.shiftKey&&activeCell){
        event.preventDefault();
        dragStart=activeCell;
        selectionFocus=point;
        dragging=true;
        selectRectangle(activeCell,point);
        return;
      }
      if(event.metaKey||event.ctrlKey){
        event.preventDefault();
        activeCell=point;
        selectionFocus=point;
        cell.classList.toggle('selected');
        updateSelectionSummary();
        return;
      }
      event.preventDefault();
      activeCell=point;
      selectionFocus=point;
      dragStart=point;
      dragging=true;
      selectRectangle(point,point);
    });
    cell.addEventListener('dblclick',event=>{
      event.preventDefault();
      const point={row:+cell.dataset.row,col:+cell.dataset.col};
      beginCellEdit(point.row,point.col,true);
    });
    cell.addEventListener('mouseenter',()=>{
      if(!dragging)return;
      selectionFocus={row:+cell.dataset.row,col:+cell.dataset.col};
      selectRectangle(dragStart,selectionFocus);
    });
    cell.addEventListener('mouseenter',()=>{
      if(checkboxBrush===null)return;
      const checkbox=cell.querySelector('input[type="checkbox"]');
      if(checkbox){
        selectionFocus={row:+cell.dataset.row,col:+cell.dataset.col};
        selectRectangle(dragStart,selectionFocus);
        setCheckboxCell(cell,checkboxBrush);
      }
    });
  });
  ensureLedgerDatePicker();
}
function updateComputed(row){
  const get=field=>row.querySelector(`[data-field="${field}"]`);
  if(config.viewKey==='cost'||config.viewKey==='unordered'){
    const target=get('variance_ex_tax');
    if(target)target.value=formatNumber(numberValue(get('invoice_amount_ex_tax')?.value)-numberValue(get('estimate_amount_ex_tax')?.value));
  }
  if(config.viewKey==='billing'){
    const target=get('outstanding_amount');
    if(target){
      target.value=formatNumber(numberValue(get('customer_invoice_amount')?.value)-numberValue(get('received_amount')?.value));
      target.closest('td')?.classList.toggle('warning-cell',numberValue(target.value)>0);
    }
  }
  if(config.viewKey==='meeting'){
    const sales=numberValue(get('sales_invoice_ex_tax')?.value);
    const cost=numberValue(get('external_cost')?.value);
    const fee=numberValue(get('fee_amount')?.value);
    const profit=sales-cost-fee;
    const profitTarget=get('gross_profit_ex_tax');
    const rateTarget=get('gross_profit_rate');
    if(profitTarget)profitTarget.value=formatNumber(profit);
    if(rateTarget)rateTarget.value=`${sales?(profit/sales*100).toFixed(1):'0.0'}%`;
  }
}
document.addEventListener('mouseup',()=>{
  dragging=false;
  checkboxBrush=null;
  setTimeout(()=>document.querySelectorAll('#ledgerBody input[type="checkbox"][data-pointer-toggle]').forEach(input=>delete input.dataset.pointerToggle),0);
});
function setCheckboxCell(cell,value){
  const checkbox=cell.querySelector('input[type="checkbox"]');
  if(!checkbox||checkbox.disabled)return;
  const wasChecked=checkbox.checked;
  checkbox.checked=value;
  markUserTouched(checkbox);
  const row=checkbox.closest('tr');
  row.classList.add('dirty');
  if(checkbox.dataset.field==='reminder_required')row.classList.toggle('row-reminder',Boolean(value));
  if(checkbox.dataset.field==='meeting_checked')syncMeetingRolloverControls(row,'meeting_checked');
  setEmptyState(checkbox);
  queueRowSave(row.dataset.key,120);
  // Reflect the change in the 翌月繰越 counter immediately — the
  // underlying row data isn't updated until the debounced save above
  // completes, so meetingCheckedCount() (which reads from viewRows)
  // would still show the stale figure for the ~120ms-1s in between.
  if(wasChecked!==value){
    const counter=$('meetingCheckedSum');
    if(counter){
      const current=parseInt(counter.textContent,10)||0;
      counter.textContent=`${Math.max(0,current+(value?1:-1))}件`;
    }
  }
}
function focusCell(row,col){
  const maxRow=Math.max(0,pageRows().length-1);
  const maxCol=Math.max(0,config.fields.length-1);
  const point={row:Math.max(0,Math.min(maxRow,row)),col:Math.max(0,Math.min(maxCol,col))};
  const cell=document.querySelector(`#ledgerBody td[data-row="${point.row}"][data-col="${point.col}"]`);
  if(!cell)return;
  activeCell=point;
  selectionFocus=point;
  selectRectangle(point,point);
  cell.scrollIntoView({block:'nearest',inline:'nearest'});
}
function beginCellEdit(row,col,selectText=false){
  const target=document.querySelector(`#ledgerBody td[data-row="${row}"][data-col="${col}"] [data-field]`);
  if(!target||target.disabled||target.readOnly)return;
  if(target.dataset.type==='date'){
    target.focus();
    openLedgerDatePicker(target);
    return;
  }
  target.focus();
  if(selectText&&typeof target.select==='function'&&target.type!=='checkbox')target.select();
}
function updateSelectionSummary(){
  const cells=selectedCells();
  let sum=0,numeric=0;
  cells.forEach(cell=>{
    const input=cell.querySelector('[data-field]');
    if(input&&(input.dataset.type==='money'||input.dataset.type==='number')){
      sum+=numberValue(input.value);
      numeric++;
    }
  });
  const target=$('selectionSum');
  if(target)target.textContent=`${cells.length}セル　数値${numeric}件　合計 ${money(sum)}`;
}
function selectRectangle(start,end){
  const range=gridCore.normalizeRange(start,end,{rows:pageRows().length,cols:config.fields.length});
  document.querySelectorAll('#ledgerBody td[data-col]').forEach(cell=>{
    const selected=+cell.dataset.row>=range.r1&&+cell.dataset.row<=range.r2&&+cell.dataset.col>=range.c1&&+cell.dataset.col<=range.c2;
    cell.classList.toggle('selected',selected);
  });
  updateSelectionSummary();
}
function selectedCells(){
  return [...document.querySelectorAll('#ledgerBody td.selected[data-col]')].sort((left,right)=>(+left.dataset.row-+right.dataset.row)||(+left.dataset.col-+right.dataset.col));
}
function cellPlainValue(cell){
  const input=cell.querySelector('[data-field]');
  if(!input)return '';
  return input.type==='checkbox'?(input.checked?'TRUE':'FALSE'):input.value;
}
function selectedCellsText(){
  const cells=selectedCells();
  if(!cells.length)return '';
  const rows=[...new Set(cells.map(cell=>+cell.dataset.row))];
  const cols=[...new Set(cells.map(cell=>+cell.dataset.col))];
  const matrix=rows.map(row=>cols.map(col=>{
    const cell=document.querySelector(`#ledgerBody td[data-row="${row}"][data-col="${col}"]`);
    return cell&&cell.classList.contains('selected')?cellPlainValue(cell):'';
  }));
  return gridCore.matrixToTsv(matrix);
}
async function copySelection(){
  const cells=selectedCells();
  const text=selectedCellsText();
  if(!cells.length||!text)return;
  if(navigator.clipboard?.writeText){
    await navigator.clipboard.writeText(text);
  }else{
    const textarea=document.createElement('textarea');
    textarea.value=text;
    textarea.style.position='fixed';
    textarea.style.opacity='0';
    document.body.append(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
  setStatus(`${cells.length}セルをコピーしました。`);
}
function pasteSelection(text){
  const selected=selectedCells();
  const first=selected[0];
  if(!first||!text)return;
  const selectedRows=[...new Set(selected.map(cell=>+cell.dataset.row))];
  const selectedCols=[...new Set(selected.map(cell=>+cell.dataset.col))];
  const selectedRange=gridCore.normalizeRange(
    {row:Math.min(...selectedRows),col:Math.min(...selectedCols)},
    {row:Math.max(...selectedRows),col:Math.max(...selectedCols)},
    {rows:pageRows().length,cols:config.fields.length}
  );
  const matrix=gridCore.parseTsv(text);
  const pastePlan=gridCore.planPaste(matrix,selectedRange,config.fields.length);
  const {startRow,startCol,rows:pasteRows,cols:pasteCols}=pastePlan;
  const touched=new Set();
  const applyValue=(cell,value)=>{
    const input=cell?.querySelector('[data-field]');
    if(!input||input.disabled||input.readOnly)return;
    const normalizedValue=String(value??'');
    if(input.type==='checkbox')input.checked=/^(true|1|yes|済|有|on|✓|✔)$/i.test(normalizedValue.trim());
    else if(input.dataset.type==='date'){
      const normalized=normalizeLedgerDate(normalizedValue);
      input.value=normalized||normalizedValue.trim();
      input.classList.toggle('invalid-date',Boolean(normalizedValue.trim()&&!normalized));
      if(input.classList.contains('invalid-date'))return;
    }else input.value=normalizedValue;
    markUserTouched(input);
    const row=input.closest('tr');
    row.classList.add('dirty');
    updateComputed(row);
    touched.add(row.dataset.key);
  };
  for(let rowOffset=0;rowOffset<pasteRows;rowOffset++){
    for(let colOffset=0;colOffset<pasteCols;colOffset++){
      const cell=document.querySelector(`#ledgerBody td[data-row="${startRow+rowOffset}"][data-col="${startCol+colOffset}"]`);
      applyValue(cell,pastePlan.valueAt(rowOffset,colOffset));
    }
  }
  touched.forEach(key=>queueRowSave(key,150));
  touched.forEach(key=>document.querySelectorAll(`#ledgerBody tr[data-key="${CSS.escape(key)}"] [data-field]`).forEach(setEmptyState));
  activeCell={row:startRow,col:startCol};
  selectionFocus={row:startRow+pasteRows-1,col:startCol+pasteCols-1};
  selectRectangle(activeCell,selectionFocus);
  setStatus(`${pasteRows}行 × ${pasteCols}列を貼り付け、自動保存しました。`);
}
function fillSelectionDown(){
  const cells=selectedCells();
  if(cells.length<2)return;
  const rowNumbers=[...new Set(cells.map(cell=>+cell.dataset.row))];
  const colNumbers=[...new Set(cells.map(cell=>+cell.dataset.col))];
  const sourceRow=Math.min(...rowNumbers);
  if(rowNumbers.length<2)return;
  const touched=new Set();
  rowNumbers.filter(row=>row>sourceRow).forEach(row=>colNumbers.forEach(col=>{
      const source=document.querySelector(`#ledgerBody td[data-row="${sourceRow}"][data-col="${col}"]`);
      const cell=document.querySelector(`#ledgerBody td[data-row="${row}"][data-col="${col}"]`);
      const input=cell?.querySelector('[data-field]');
      if(!source||!cell)return;
      const sourceValue=cellPlainValue(source);
      if(!input||input.disabled||input.readOnly)return;
      if(input.type==='checkbox')input.checked=sourceValue==='TRUE';
      else if(input.dataset.type==='date'){
        const normalized=normalizeLedgerDate(sourceValue);
        input.value=normalized||sourceValue;
        input.classList.toggle('invalid-date',Boolean(sourceValue&&!normalized));
        if(input.classList.contains('invalid-date'))return;
      }else input.value=sourceValue;
      markUserTouched(input);
      const rowElement=input.closest('tr');
      rowElement.classList.add('dirty');
      updateComputed(rowElement);
      touched.add(rowElement.dataset.key);
    }));
  touched.forEach(key=>queueRowSave(key,150));
  touched.forEach(key=>document.querySelectorAll(`#ledgerBody tr[data-key="${CSS.escape(key)}"] [data-field]`).forEach(setEmptyState));
  setStatus(`${rowNumbers.length}行へ上端行をコピーし、自動保存しました。`);
}
function fillSelectionRight(){
  const cells=selectedCells();
  if(cells.length<2)return;
  const rowNumbers=[...new Set(cells.map(cell=>+cell.dataset.row))];
  const colNumbers=[...new Set(cells.map(cell=>+cell.dataset.col))].sort((left,right)=>left-right);
  if(colNumbers.length<2)return;
  const sourceCol=colNumbers[0],touched=new Set();
  rowNumbers.forEach(row=>{
    const source=document.querySelector(`#ledgerBody td[data-row="${row}"][data-col="${sourceCol}"]`);
    if(!source)return;
    const sourceValue=cellPlainValue(source);
    colNumbers.slice(1).forEach(col=>{
      const cell=document.querySelector(`#ledgerBody td[data-row="${row}"][data-col="${col}"]`);
      const input=cell?.querySelector('[data-field]');
      if(!input||input.disabled||input.readOnly)return;
      if(input.type==='checkbox')input.checked=sourceValue==='TRUE';
      else if(input.dataset.type==='date'){
        const normalized=normalizeLedgerDate(sourceValue);
        input.value=normalized||sourceValue;
        input.classList.toggle('invalid-date',Boolean(sourceValue&&!normalized));
        if(input.classList.contains('invalid-date'))return;
      }else input.value=sourceValue;
      markUserTouched(input);
      const rowElement=input.closest('tr');
      rowElement.classList.add('dirty');
      updateComputed(rowElement);
      setEmptyState(input);
      touched.add(rowElement.dataset.key);
    });
  });
  touched.forEach(key=>queueRowSave(key,150));
  setStatus(`${colNumbers.length}列へ左端列をコピーし、自動保存しました。`);
}
function fillSelectionWithActive(){
  const cells=selectedCells();
  if(cells.length<2)return;
  const source=document.querySelector(`#ledgerBody td[data-row="${activeCell?.row}"][data-col="${activeCell?.col}"]`)||cells[0];
  if(!source)return;
  const sourceValue=cellPlainValue(source),touched=new Set();
  cells.forEach(cell=>{
    const input=cell.querySelector('[data-field]');
    if(!input||input.disabled||input.readOnly)return;
    if(input.type==='checkbox')input.checked=sourceValue==='TRUE';
    else if(input.dataset.type==='date'){
      const normalized=normalizeLedgerDate(sourceValue);
      input.value=normalized||sourceValue;
      input.classList.toggle('invalid-date',Boolean(sourceValue&&!normalized));
      if(input.classList.contains('invalid-date'))return;
    }else input.value=sourceValue;
    markUserTouched(input);
    const row=input.closest('tr');
    row.classList.add('dirty');
    updateComputed(row);
    setEmptyState(input);
    touched.add(row.dataset.key);
  });
  touched.forEach(key=>queueRowSave(key,150));
  setStatus(`${cells.length}セルへ同じ値を入力し、自動保存しました。`);
}
function clearSelectedValues(){
  const touched=new Set();
  selectedCells().forEach(cell=>{
    const input=cell.querySelector('[data-field]');
    if(!input||input.disabled||input.readOnly)return;
    if(input.type==='checkbox')input.checked=false;
    else input.value='';
    markUserTouched(input);
    const row=input.closest('tr');
    row.classList.add('dirty');
    updateComputed(row);
    setEmptyState(input);
    touched.add(row.dataset.key);
  });
  touched.forEach(key=>queueRowSave(key,120));
  updateSelectionSummary();
}
function typeIntoActiveCell(key){
  const point=selectionFocus||activeCell;
  if(!point)return false;
  const input=document.querySelector(`#ledgerBody td[data-row="${point.row}"][data-col="${point.col}"] [data-field]`);
  if(!input||input.disabled||input.readOnly||input.tagName==='SELECT'||input.type==='checkbox'||input.dataset.type==='date')return false;
  input.focus();
  input.value=key;
  markUserTouched(input);
  const row=input.closest('tr');
  row.classList.add('dirty');
  updateComputed(row);
  setEmptyState(input);
  queueRowSave(row.dataset.key);
  return true;
}
function hasNativeEditorSelection(input=document.activeElement){
  if(!input?.matches?.('#ledgerBody input,#ledgerBody textarea'))return false;
  return Number.isInteger(input.selectionStart)&&Number.isInteger(input.selectionEnd)&&input.selectionStart!==input.selectionEnd;
}
document.addEventListener('keydown',event=>{
  const editorElement=document.activeElement?.matches?.('#ledgerBody input,#ledgerBody select')?document.activeElement:null;
  const editor=Boolean(editorElement&&editorElement.type!=='checkbox');
  const command=event.metaKey||event.ctrlKey;
  const key=event.key.toLowerCase();
  const selectedCount=selectedCells().length;
  if(command&&selectedCount&&!hasNativeEditorSelection()){
    if(key==='c'){
      event.preventDefault();
      copySelection();
      return;
    }
    if(key==='x'){
      event.preventDefault();
      copySelection();
      clearSelectedValues();
      return;
    }
    if(key==='d'&&selectedCount>1){
      event.preventDefault();
      fillSelectionDown();
      return;
    }
    if(key==='r'&&selectedCount>1){
      event.preventDefault();
      fillSelectionRight();
      return;
    }
    if(event.key==='Enter'&&selectedCount>1){
      event.preventDefault();
      fillSelectionWithActive();
      return;
    }
  }
  if(editor){
    if(event.key==='Escape'){
      event.preventDefault();
      const cell=document.activeElement.closest('td[data-col]');
      document.activeElement.blur();
      if(cell)focusCell(+cell.dataset.row,+cell.dataset.col);
    }
    return;
  }
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='a'&&pageRows().length){
    event.preventDefault();
    activeCell={row:0,col:0};
    selectionFocus={row:pageRows().length-1,col:config.fields.length-1};
    selectRectangle(activeCell,selectionFocus);
    return;
  }
  if(!activeCell)return;
  if(event.key==='Enter'||event.key==='F2'){
    event.preventDefault();
    beginCellEdit(activeCell.row,activeCell.col,event.key==='Enter');
    return;
  }
  if(event.key==='Delete'||event.key==='Backspace'){
    event.preventDefault();
    clearSelectedValues();
    return;
  }
  const moves={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]};
  if(moves[event.key]){
    event.preventDefault();
    const origin=selectionFocus||activeCell;
    const target=gridCore.movePoint(origin,event.key,{rows:pageRows().length,cols:config.fields.length});
    if(event.shiftKey){
      selectionFocus=target;
      selectRectangle(activeCell,target);
      document.querySelector(`#ledgerBody td[data-row="${target.row}"][data-col="${target.col}"]`)?.scrollIntoView({block:'nearest',inline:'nearest'});
    }else{
      focusCell(target.row,target.col);
    }
    return;
  }
  if(event.key==='Tab'){
    event.preventDefault();
    const origin=selectionFocus||activeCell;
    const target=gridCore.movePoint(origin,'Tab',{rows:pageRows().length,cols:config.fields.length},{shiftKey:event.shiftKey});
    focusCell(target.row,target.col);
    return;
  }
  if(event.key.length===1&&!event.metaKey&&!event.ctrlKey&&!event.altKey&&typeIntoActiveCell(event.key)){
    event.preventDefault();
  }
});
document.addEventListener('copy',event=>{
  const cells=selectedCells();
  if(!cells.length||hasNativeEditorSelection())return;
  const text=selectedCellsText();
  if(!text||!event.clipboardData)return;
  event.clipboardData.setData('text/plain',text);
  event.preventDefault();
  setStatus(`${cells.length}セルをコピーしました。`);
});
document.addEventListener('cut',event=>{
  const cells=selectedCells();
  if(!cells.length||hasNativeEditorSelection())return;
  const text=selectedCellsText();
  if(!text||!event.clipboardData)return;
  event.clipboardData.setData('text/plain',text);
  event.preventDefault();
  clearSelectedValues();
  setStatus(`${cells.length}セルを切り取りました。`);
});
document.addEventListener('paste',event=>{
  const cells=selectedCells();
  if(!cells.length)return;
  const text=event.clipboardData.getData('text/plain');
  const editor=document.activeElement?.matches?.('#ledgerBody input,#ledgerBody textarea,#ledgerBody select');
  if(editor&&cells.length===1&&!/[\t\r\n]/.test(text))return;
  event.preventDefault();
  pasteSelection(text);
});
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden')flushDirtyRows();
});
window.addEventListener('pagehide',()=>flushDirtyRows());
function rawInputValue(input,field){
  if(field.type==='checkbox')return input.checked;
  if(field.type==='money')return input.value.trim()===''?'':numberValue(input.value);
  if(field.type==='month')return normalizeMonth(input.value);
  if(field.type==='date')return normalizeLedgerDate(input.value);
  return input.value.trim();
}
function sameValue(left,right,field){
  if(field.type==='money')return numberValue(left)===numberValue(right);
  if(field.type==='checkbox')return Boolean(left)===Boolean(right);
  if(field.type==='month')return normalizeMonth(left)===normalizeMonth(right);
  if(field.type==='date')return normalizeLedgerDate(left)===normalizeLedgerDate(right);
  return String(left??'')===String(right??'');
}
function queueRowSave(key,delay=650){
  clearTimeout(saveTimers.get(key));
  saveTimers.set(key,setTimeout(()=>saveRow(key),delay));
  setStatus('変更を自動保存します…');
}
async function syncCanonicalRow(source,row){
  const valueOf=fieldKey=>{
    const field=config.fields.find(item=>item.key===fieldKey);
    const input=row.querySelector(`[data-field="${fieldKey}"]`);
    return input&&field?rawInputValue(input,field):undefined;
  };
  if(config.viewKey==='billing'){
    const invoiceAmount=numberValue(valueOf('customer_invoice_amount'));
    const receivedValue=valueOf('received_amount');
    const receivedAmount=receivedValue===''?null:numberValue(receivedValue);
    const receivedChecked=Boolean(valueOf('received_checked'));
    const externalCost=numberValue(valueOf('external_cost'));
    const externalPaid=Boolean(valueOf('external_paid_checked'));
    const invoiceDate=valueOf('invoice_date')||null;
    const paymentReceivedOn=valueOf('payment_received_on')||null;
    const accountingMonth=valueOf('accounting_month')||null;
    const receivedAmountTouched=row.querySelector('[data-field="received_amount"]')?.dataset.userTouched==='true';
    const paymentStateTouched=['received_checked','payment_received_on'].some(fieldKey=>
      row.querySelector(`[data-field="${fieldKey}"]`)?.dataset.userTouched==='true');
    const existing=projectFor(source.projectId);
    const {data,error}=await db.rpc('save_billing_ledger_row',{
      p_project_id:source.projectId,
      p_expected_revision:numberValue(existing.revision),
      p_patch:{
        invoice_amount:invoiceAmount,received_amount:receivedAmount,received_checked:receivedChecked,
        received_amount_touched:receivedAmountTouched,
        payment_state_touched:paymentStateTouched,
        external_cost:externalCost,external_paid:externalPaid,invoice_date:invoiceDate,
        payment_received_on:paymentReceivedOn,accounting_month:accountingMonth
      }
    });
    if(error)return error;
    const patch=data||{};
    Object.assign(existing,patch);
    const bankAutomatic=numberValue(existing.bank_received_amount_ex_tax)>0?numberValue(existing.bank_received_amount_ex_tax):'';
    const effectiveReceived=receivedAmountTouched
      ?(patch.received_amount_ex_tax===null||patch.received_amount_ex_tax===undefined?bankAutomatic:numberValue(patch.received_amount_ex_tax))
      :source.auto.received_amount;
    Object.assign(source.auto,{
      accounting_month:normalizeMonth(patch.accounting_month),
      invoice_date:patch.invoice_date||'',
      received_amount:effectiveReceived,
      received_checked:patch.customer_payment_status==='入金済',
      payment_received_on:patch.payment_received_on||'',
      completed_on:patch.completed_on||'',
      external_cost:numberValue(patch.external_cost_ex_tax),
      external_paid_checked:patch.vendor_payment_status==='支払済',
      outstanding_amount:invoiceAmount-numberValue(effectiveReceived)
    });
    return null;
  }
  if((config.viewKey==='cost'||config.viewKey==='unordered')&&source.lines?.length){
    const invoiceTotal=numberValue(valueOf('invoice_amount_ex_tax'));
    const invoiceDate=valueOf('invoice_from_vendor_date')||null;
    const paymentDate=valueOf('payment_date')||null;
    const reminderRequired=Boolean(valueOf('reminder_required'));
    const paid=Boolean(paymentDate);
    const basis=source.lines.reduce((sum,line)=>sum+numberValue(line.order_amount_ex_tax),0);
    let distributed=0;const linePatches=[];
    for(let index=0;index<source.lines.length;index++){
      const line=source.lines[index];
      const lineAmount=index===source.lines.length-1
        ?invoiceTotal-distributed
        :Math.round(invoiceTotal*(basis?numberValue(line.order_amount_ex_tax)/basis:1/source.lines.length));
      distributed+=lineAmount;
      linePatches.push({id:line.id,expected_revision:numberValue(line.revision),invoice_amount:lineAmount,
        invoice_date:invoiceDate,payment_date:paymentDate,reminder_required:reminderRequired});
    }
    const project=projectFor(source.projectId);
    const {data,error}=await db.rpc('save_cost_ledger_row',{
      p_project_id:source.projectId,p_expected_project_revision:numberValue(project.revision),p_lines:linePatches
    });
    if(error)return error;
    const result=data||{},lineResults=new Map((result.lines||[]).map(item=>[String(item.id),item]));
    source.lines.forEach((line,index)=>{const saved=lineResults.get(String(line.id));Object.assign(line,{
      supplier_invoice_amount_ex_tax:linePatches[index].invoice_amount,
      supplier_invoice_date:invoiceDate,supplier_payment_date:paymentDate,supplier_paid:paid,
      reminder_required:reminderRequired,line_status:saved?.line_status||line.line_status,
      revision:saved?.revision??line.revision
    })});
    Object.assign(project,{vendor_payment_status:result.vendor_payment_status,project_status:result.project_status,revision:result.project_revision});
    Object.assign(source.auto,{
      invoice_amount_ex_tax:invoiceTotal||'',
      invoice_from_vendor_date:invoiceDate||'',
      payment_date:paymentDate||'',
      payment_month:normalizeMonth(paymentDate||''),
      external_paid_checked:paid,
      reminder_required:reminderRequired,
      variance_ex_tax:invoiceTotal-numberValue(source.auto.estimate_amount_ex_tax)
    });
  }
  return null;
}
async function applyLedgerBlanksToEstimate(source,manual){
  if(config.viewKey!=='management'||!source.projectId)return {applied:[],error:null};
  const changes={};
  config.fields.forEach(field=>{
    if(!LEDGER_TO_ESTIMATE_BLANK_FIELDS.has(field.key))return;
    if(!Object.hasOwn(manual,field.key)||!isEmptyField({...field,optional:false},source.auto[field.key]))return;
    changes[field.key]={
      label:field.label.replace(/<br>/g,' '),
      automatic:source.auto[field.key]??null,
      requested:manual[field.key]
    };
  });
  if(!Object.keys(changes).length)return {applied:[],error:null};
  const {data,error}=await db.rpc('apply_ledger_blank_fields_to_estimate',{
    p_project_id:source.projectId,
    p_changes:changes
  });
  return {applied:Array.isArray(data?.applied)?data.applied:[],error};
}
async function syncLedgerInputsToEstimate(source,manual){
  if(config.viewKey==='meeting')return {applied:[],error:null};
  if(!source.projectId||!Object.keys(manual).length)return {applied:[],error:null};
  const {data,error}=await db.rpc('sync_ledger_inputs_to_estimate',{
    p_project_id:source.projectId,
    p_view_key:config.viewKey,
    p_vendor_name:source.auto.vendor_name||'',
    p_category:source.auto.category||'',
    p_changes:Object.fromEntries(Object.entries(manual).map(([fieldKey,requested])=>[fieldKey,{requested}]))
  });
  return {applied:Array.isArray(data?.applied)?data.applied:[],error};
}
function pendingWritebackFields(manual){
  const allowed=config.viewKey==='management'
    ?['reception_date','input_date','staff_name','work_name','scheduled_completion_date','completed_on','accounting_month','customer_name','customer_contact_name','notes']
    :config.viewKey==='billing'
      ?['invoice_date','accounting_month']
      :config.viewKey==='meeting'
        ?[]
      :['invoice_amount_ex_tax','invoice_from_vendor_date','payment_date','reminder_required'];
  return Object.fromEntries(Object.entries(manual||{}).filter(([key])=>allowed.includes(key)));
}
async function reconcilePendingLedgerWritebacks(){
  if(pendingWritebackReconciliation)return;
  const candidates=allRows.filter(source=>source.projectId&&Object.keys(pendingWritebackFields(overrides.get(source.key)||{})).length);
  if(!candidates.length)return;
  pendingWritebackReconciliation=true;
  let repaired=0;
  try{
    for(const source of candidates){
      const manual={...(overrides.get(source.key)||{})};
      const pending=pendingWritebackFields(manual);
      const result=await syncLedgerInputsToEstimate(source,pending);
      if(result.error)continue;
      result.applied.forEach(fieldKey=>{
        source.auto[fieldKey]=manual[fieldKey];
        delete manual[fieldKey];
      });
      if(!result.applied.length)continue;
      const error=await persistManualOverride(source,source.key,manual);
      if(!error)repaired+=result.applied.length;
    }
  }finally{
    pendingWritebackReconciliation=false;
  }
  if(repaired){
    applyView(true);
    setStatus(`以前の台帳入力 ${repaired}項目を見積元データへ反映しました。`);
  }
}
async function persistManualOverride(source,key,manual){
  const {data,error}=await db.rpc('save_project_manual_override',{
    p_view_key:config.viewKey,p_row_key:key,p_project_id:source.projectId||null,
    p_field_values:manual,p_expected_revision:overrideRevisions.get(key)||0
  });
  if(error)return error;
  if(data?.deleted){
    overrides.delete(key);
    overrideRevisions.delete(key);
  }else{
    overrides.set(key,manual);
    overrideRevisions.set(key,numberValue(data?.revision));
  }
  return null;
}
async function saveRow(key){
  clearTimeout(saveTimers.get(key));
  saveTimers.delete(key);
  const source=allRows.find(row=>row.key===key);
  if(!source)return;
  const row=document.querySelector(`#ledgerBody tr[data-key="${CSS.escape(key)}"]`);
  if(!row)return;
  const invalidDate=row.querySelector('.invalid-date');
  if(invalidDate){
    setStatus('日付は「2026/07/20」または「2026-07-20」の形式で入力してください。',true);
    invalidDate.focus();
    return;
  }
  const previousManual={...(overrides.get(key)||{})};
  const manual={...previousManual};
  config.fields.forEach(field=>{
    if(field.locked||field.computed)return;
    const input=row.querySelector(`[data-field="${field.key}"]`);
    if(!input)return;
    const value=rawInputValue(input,field);
    if(value===''||sameValue(value,source.auto[field.key],field))delete manual[field.key];
    else manual[field.key]=value;
  });
  const manualChanged=JSON.stringify(previousManual)!==JSON.stringify(manual);
  let error=await persistManualOverride(source,key,manual);
  if(error){
    setStatus(`保存できません：${error.message}`,true);
    return alert(`保存できません。\n${error.message}`);
  }
  const blankFill=await applyLedgerBlanksToEstimate(source,manual);
  if(blankFill.error){
    setStatus(`台帳は保存しましたが、見積の空欄へ反映できません：${blankFill.error.message}`,true);
    return alert(`見積の空欄へ反映できません。\n${blankFill.error.message}`);
  }
  blankFill.applied.forEach(fieldKey=>{
    source.auto[fieldKey]=manual[fieldKey];
    delete manual[fieldKey];
  });
  if(blankFill.applied.length){
    error=await persistManualOverride(source,key,manual);
    if(error){
      setStatus(`見積へ反映しましたが、台帳上書きを整理できません：${error.message}`,true);
      return alert(`台帳上書きを整理できません。\n${error.message}`);
    }
  }
  const canonicalError=await syncCanonicalRow(source,row);
  if(canonicalError){
    setStatus(`台帳表示は保存しましたが、正本DBへ反映できません：${canonicalError.message}`,true);
    return alert(`正本DBへ反映できません。\n${canonicalError.message}\n\nSUPABASE_UX16_統合更新.sql の最新版を確認してください。`);
  }
  const sourceWrite=await syncLedgerInputsToEstimate(source,manual);
  if(sourceWrite.error){
    const missingFunction=/sync_ledger_inputs_to_estimate|schema cache|PGRST202/i.test(sourceWrite.error.message||'');
    setStatus(missingFunction
      ?'台帳は保存しました。元データへの反映には「SUPABASE_UX42_台帳入力を正本へ反映.sql」の適用が必要です。'
      :`台帳は保存しましたが、元データへの反映に失敗しました：${sourceWrite.error.message}`,true);
    // 台帳だけ保存できたことを「自動保存完了」で上書きしない。
    // 上書き印を残して、次回の自動再試行と利用者の確認対象にする。
    return;
  }else if(sourceWrite.applied.length){
    sourceWrite.applied.forEach(fieldKey=>{
      source.auto[fieldKey]=manual[fieldKey];
      delete manual[fieldKey];
    });
    error=await persistManualOverride(source,key,manual);
    if(error)return alert(`元データへ反映しましたが、台帳上書きを整理できません：${error.message}`);
  }
  if(manualChanged&&source.projectId){
    const requestedChanges={};
    config.fields.forEach(field=>{
      const guide=fieldGuides[field.key];
      if(!guide||!['auto','mixed'].includes(guide.mode)||!Object.hasOwn(manual,field.key))return;
      requestedChanges[field.key]={
        label:field.label.replace(/<br>/g,' '),
        automatic:source.auto[field.key]??null,
        requested:manual[field.key]
      };
    });
    if(Object.keys(requestedChanges).length){
      const {error:requestError}=await db.rpc('request_project_change',{
        p_project_id:source.projectId,
        p_management_number:source.auto.management_number||'',
        p_source_view:config.viewKey,
        p_source_row_key:key,
        p_changes:requestedChanges,
        p_reason:'台帳で自動連携項目が変更されました'
      });
      if(requestError){
        setStatus(`台帳は保存しましたが、見積更新依頼を登録できません：${requestError.message}`,true);
      }
    }
  }
  config.fields.forEach(field=>{
    if(field.locked||field.computed||Object.hasOwn(manual,field.key))return;
    const input=row.querySelector(`[data-field="${field.key}"]`);
    const automatic=source.auto[field.key];
    if(!input||automatic===undefined||automatic===null||automatic==='')return;
    if(field.type==='checkbox')input.checked=Boolean(automatic);
    else if(input.value==='')input.value=field.type==='money'?formatNumber(automatic):field.type==='month'?normalizeMonth(automatic):automatic;
    setEmptyState(input);
  });
  row.classList.remove('dirty');
  row.querySelectorAll('[data-user-touched]').forEach(input=>delete input.dataset.userTouched);
  renderSummary();
  setStatus(blankFill.applied.length
    ?`${source.auto.management_number||''} を保存し、見積の空欄へ ${blankFill.applied.length}項目を反映しました。`
    :`${source.auto.management_number||''} を自動保存しました。空欄に戻した項目は自動同期値が優先されます。`);
  $('ledgerStatus').classList.add('autosave');
}
async function deleteLedgerRow(button){
  const key=button.closest('tr')?.dataset.key;
  const source=allRows.find(row=>row.key===key);
  if(!source)return;
  const number=source.auto.management_number||'この行';
  const vendor=source.auto.vendor_name?` / ${source.auto.vendor_name}`:'';
  if(!confirm(`${number}${vendor} を削除します。\n\n見積・発注・原価・請求の関連データから非表示になります。一度発行した管理番号は欠番のまま再利用されません。続けますか？`))return;
  const confirmation=prompt(`最終確認です。\n削除する管理番号「${number}」を入力してください。`);
  if(confirmation===null)return;
  if(confirmation.trim()!==number)return alert('管理番号が一致しないため、削除を中止しました。');
  let error;
  if((config.viewKey==='cost'||config.viewKey==='unordered')&&source.lineItemIds?.length){
    ({error}=await db.rpc('soft_delete_project_lines',{
      p_line_ids:source.lineItemIds,
      p_confirmation_number:number,
      p_reason:`${config.title}から削除`
    }));
    if(!error)lineItems=lineItems.filter(line=>!source.lineItemIds.includes(line.id));
  }else{
    ({error}=await db.rpc('soft_delete_project',{
      p_project_id:source.projectId,
      p_confirmation_number:number,
      p_reason:`${config.title}から削除`
    }));
    if(!error)projects=projects.filter(project=>project.id!==source.projectId);
  }
  if(error)return alert(`削除できません。\n${error.message}\n\nSUPABASE_UX16_統合更新.sql を実行済みか確認してください。`);
  allRows=buildRows();
  applyView();
}
function csvCell(value){return `"${String(value??'').replaceAll('"','""')}"`}
function downloadCsv(){
  const headers=config.fields.map(field=>field.label.replace(/<br>/g,''));
  const rows=viewRows.map(row=>{const values=mergedRow(row).values;return config.fields.map(field=>values[field.key]??'')});
  const csv=[headers,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n');
  const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
  const link=document.createElement('a');
  link.href=URL.createObjectURL(blob);
  link.download=`${config.title}_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
$('search').addEventListener('input',()=>{
  clearTimeout(searchTimer);
  searchTimer=setTimeout(()=>applyView(true),140);
});
$('yearFilter').addEventListener('change',()=>loadData());
$('zoom').addEventListener('change',()=>document.documentElement.style.setProperty('--zoom',$('zoom').value));
window.addEventListener('resize',()=>requestAnimationFrame(updateSheetHeight));
window.addEventListener('storage',event=>{if(event.key==='izumi-ledger-refresh')scheduleLedgerReload();});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden||!ledgerRealtimeTimer)return;
  clearTimeout(ledgerRealtimeTimer);
  ledgerRealtimeTimer=null;
  loadData();
});
initLoginHelp();
db.auth.onAuthStateChange((_event,session)=>{if(session)showApp();else revealLogin()});
db.auth.getSession().then(({data:{session}})=>{if(session)showApp();else revealLogin()});

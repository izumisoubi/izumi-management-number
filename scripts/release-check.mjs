#!/usr/bin/env node
import {existsSync,readFileSync,writeFileSync,rmSync,readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const requiredFiles=['index.html','kanribangou.html','estimate.html','calendar.html','認証セッション共通.js','表入力共通.js','見積計算共通.js','自社原価共通.js','バックアップ共通.js','年度共通.js','本日日付共通.js','台帳期限共通.js','台帳共通.js','台帳共通.css','SUPABASE_UX42_台帳入力を正本へ反映.sql','BACKUP_AND_RECOVERY.md','demo/index.html','demo/demo-data.js','demo/demo-runtime.js','demo/本日日付共通.js','demo/管理番号取得.html','demo/calendar.html','demo/管理番号台帳.html','demo/工事リスト・未発注.html','demo/工事リスト・原価.html','demo/請求.html','demo/会議用案件一覧.html','demo/銀行入金照合.html','demo/支払通知書.html','demo/変更注文・締め管理.html','demo/システム管理.html','demo/estimate.html','demo/estimate/index.html','demo/estimate/standalone.js','demo/estimate/demo-integration.js','demo/estimate/表入力共通.js','demo/estimate/見積計算共通.js','demo/estimate/自社原価共通.js','demo/estimate/年度共通.js','demo/estimate/本日日付共通.js','demo/estimate/assets/stamps/demo-company.svg','demo/estimate/assets/stamps/demo-person.svg','scripts/build-demo-mirror.mjs'];
const failures=[];
const expect=(condition,message)=>{if(!condition)failures.push(message)};
const read=file=>readFileSync(file,'utf8');

requiredFiles.forEach(file=>expect(existsSync(file),`必須ファイルがありません: ${file}`));
if(!failures.length){
  const estimate=read('estimate.html');
  const calendar=read('calendar.html');
  const gridCore=read('表入力共通.js');
  const estimateMath=read('見積計算共通.js');
  const selfCosts=read('自社原価共通.js');
  const backupCore=read('バックアップ共通.js');
  const authSession=read('認証セッション共通.js');
  const fiscalYear=read('年度共通.js');
  const ledger=read('台帳共通.js');
  const ledgerDates=read('台帳期限共通.js');
  const ledgerWritebackSql=read('SUPABASE_UX42_台帳入力を正本へ反映.sql');
  const demoHtml=read('demo/index.html');
  const demoDataSource=read('demo/demo-data.js');
  const demoRuntimeSource=read('demo/demo-runtime.js');
  const demoEstimateHtml=read('demo/estimate/index.html');
  const demoEstimateStandalone=read('demo/estimate/standalone.js');
  const demoEstimateIntegration=read('demo/estimate/demo-integration.js');
  const rootHtmlFiles=readdirSync('.').filter(file=>file.endsWith('.html'));
  rootHtmlFiles.forEach(file=>expect(read(file).includes('本日日付共通.js?v=20260808-TODAY1'),`${file} が本日の日付表示を読み込んでいません`));
  const todayDisplay=read('本日日付共通.js');
  ['todayDateDisplay','本日　','weekdays','scheduleNextDay','today-date-full','today-date-short','@media print'].forEach(text=>expect(todayDisplay.includes(text),`本日の日付表示の契約が見つかりません: ${text}`));
  expect(demoEstimateHtml.includes('本日日付共通.js?v=20260808-TODAY1'),`デモ見積が本日の日付表示を読み込んでいません`);
  const requiredEstimateContracts=['is_current_app_user_enabled','is_management_admin','save_project_bundle','onlineProjectSummary','grossProfit','async function loadOnlineProjectByNumber(managementNumber','const restored=await loadOnlineProjectByNumber(item.management_number,{silentWhenMissing:true,showToast:false});','scheduleOnlineAutosave(250)'];
  const requiredLedgerContracts=['save_cost_ledger_row','save_billing_ledger_row','values.variance_ex_tax=numberValue(values.invoice_amount_ex_tax)-numberValue(values.estimate_amount_ex_tax)'];
  const requiredGridContracts=['normalizeRange','parseTsv','matrixToTsv','planPaste','movePoint','rangeMatrix'];
  const requiredEstimateMathContracts=['unitFromMargin','costAmount','customerUnit','customerAmount','burdenSplitFromGross'];
  const requiredSelfCostContracts=['slotTotal','normalize','setSlot','setGross','setTotal'];
  requiredEstimateContracts.forEach(text=>expect(estimate.includes(text),`見積の重要契約が見つかりません: ${text}`));
  ['function todayDateValue()','function displayDateValue(id)',"const invoiceDisplayDate=displayDateValue('i-date-in')"].forEach(text=>expect(estimate.includes(text),`未確定日付を本日表示する契約が見つかりません: ${text}`));
  ['loadEvents','render()','saveQuickEntry','updateEventDirect','persistCalendarEvent','newEvent','editEvent'].forEach(text=>expect(calendar.includes(text),`カレンダーの重要機能が見つかりません: ${text}`));
  ['calendar-command','month-nav','calendar-legend','event-direct-content','event-slot','sticky-calendar-shell','newLeaveFromCell','saveLeavePeriod','leavePickerBack','renderTodayAttendance','attendanceForDate','date-attendance','japaneseHolidayMap','holiday-label','weekday-row','saturday-row','sunday-row','4px double','#e0efff','#ffe0e5','th.date-col','z-index:120','scroll-snap-type:y mandatory','scroll-snap-stop:always','explicitReturnStatus','calendarReturnStatus','normalizeDisplaySlot','positionCalendarEvents','data-slot="${slot}"','display_slot:normalizeDisplaySlot(content.dataset.slot)',"!['メモ','予定'].includes(statusValue)",'setAuthView','data-auth-view="app"',"event==='INITIAL_SESSION'","scheduleWrap.classList.toggle('is-scrolled'"].forEach(text=>expect(calendar.includes(text),`カレンダーの新しい表示構造が見つかりません: ${text}`));
  ['autoRefreshToken:true','persistSession:true','detectSessionInUrl:true','storage:window.localStorage'].forEach(text=>expect(authSession.includes(text),`30日ログイン継続の設定が見つかりません: ${text}`));
  const supabasePages=readdirSync('.').filter(file=>file.endsWith('.html')&&read(file).includes('@supabase/supabase-js@2'));
  supabasePages.forEach(file=>expect(read(file).includes('認証セッション共通.js'),`${file} が共通ログイン継続設定を読み込んでいません`));
  requiredLedgerContracts.forEach(text=>expect(ledger.includes(text),`台帳の重要契約が見つかりません: ${text}`));
  const continuousLedgerPages=['管理番号台帳.html','工事リスト・未発注.html','工事リスト・原価.html','請求.html','会議用案件一覧.html'];
  continuousLedgerPages.forEach(file=>expect(read(file).includes('continuousRows:true')&&read(file).includes('台帳共通.js?v=20260808-MONTH56'),`${file} の全件連続表示設定またはキャッシュ更新が見つかりません`));
  ['const continuousRows=config.continuousRows!==false', 'pageSize=continuousRows?0:200', 'const continuousWindowSize=200', 'scheduleContinuousWindow(targetStart)', 'viewRows.slice(continuousWindowStart,continuousWindowStart+continuousWindowSize)', 'class="virtual-spacer"', 'pageSize>0?\`<nav id="pager"'].forEach(text=>expect(ledger.includes(text),`台帳の軽量な全件連続表示が見つかりません: ${text}`));
  ['id="accountingMonthFilter"',"searchParams.get('accounting_month')",'normalizeMonth(merged.values.accounting_month)===normalizeMonth(accountingMonth)',"if($('accountingMonthFilter'))$('accountingMonthFilter').value='';"].forEach(text=>expect(ledger.includes(text),`台帳の計上月絞り込みが見つかりません: ${text}`));
  expect(ledger.includes('new Date().getMonth()+1'),`台帳の初期計上月が開いた日の月になっていません`);
  expect(read('台帳共通.css').includes('tr.virtual-spacer td'),`台帳の仮想スクロール用スタイルが見つかりません`);
  expect(read('台帳共通.css').includes('.field.accounting-month-filter'),`台帳の計上月絞り込み用スタイルが見つかりません`);
  const bankLedger=read('銀行入金照合.html'),electronicLedger=read('電子帳簿検索.html'),paymentNotice=read('支払通知書.html'),closing=read('変更注文・締め管理.html');
  expect(bankLedger.includes('transactionHasMore')&&bankLedger.includes("loadTransactions(true)")&&!bankLedger.includes('transactionPrev'),`銀行入金照合が軽量な連続読込になっていません`);
  expect(electronicLedger.includes('visibleRecordCount')&&electronicLedger.includes('recordBatchSize')&&!electronicLedger.includes('movePage('),`電子帳簿検索が軽量な連続表示になっていません`);
  expect(paymentNotice.includes('noticeVisibleCount')&&!paymentNotice.includes('changeNoticePage('),`支払通知書が軽量な連続表示になっていません`);
  expect(closing.includes('async function fetchAll(buildQuery)')&&!closing.includes('.limit(200)'),`変更注文・締め管理に200件制限が残っています`);
  requiredGridContracts.forEach(text=>expect(gridCore.includes(text),`共通表入力の契約が見つかりません: ${text}`));
  requiredEstimateMathContracts.forEach(text=>expect(estimateMath.includes(text),`見積計算の契約が見つかりません: ${text}`));
  requiredSelfCostContracts.forEach(text=>expect(selfCosts.includes(text),`自社原価の契約が見つかりません: ${text}`));
  expect(estimate.includes('表入力共通.js')&&estimate.includes('window.IzumiGridCore'),`見積・請求・発注表が共通表入力へ接続されていません`);
  expect(estimate.includes("sfnCalcFmt(${r.id},'qty',this)")&&estimate.includes('Home / End はセル移動ではなく'),`数量の全角・小数・数式入力またはセル内文字編集の保護が見つかりません`);
  expect(estimate.includes('バックアップ共通.js')&&estimate.includes('window.IzumiBackup.parseAndValidate'),`JSONバックアップの事前検証が見積システムへ接続されていません`);
  expect(!estimate.includes('seed_shared_master_records'),`オンラインの共通マスタへコード同梱データを自動再投入する処理が残っています`);
  ['vendorDetails=grouped.vendor;','clientList2=dedupeClientMasterRows(grouped.client);','propertyList=validPropertyMasterRows(grouped.property);'].forEach(text=>expect(estimate.includes(text),`オンライン共通マスタの0件状態を正本として扱う契約が見つかりません: ${text}`));
  expect(estimate.includes('Array.isArray(parsed)?parsed:JSON.parse(JSON.stringify(INIT_PROPERTIES))'),`空の物件マスタがコード同梱の初期値へ戻る可能性があります`);
  expect(estimate.includes("if(type==='client')data.name=canonicalCompanyName(data.name)")&&estimate.includes('は既に登録されています。既存の取引先を編集してください。'),`取引先名の正規化または重複登録防止が見つかりません`);
  ['parseAndValidate','validateRow','data[key].length>10000'].forEach(text=>expect(backupCore.includes(text),`JSONバックアップ検証の契約が見つかりません: ${text}`));
  expect(estimate.includes('見積計算共通.js')&&estimate.includes('window.IzumiEstimateMath'),`見積表が共通計算へ接続されていません`);
  ['work_items','client_unit_prices','vendor_effective_unit_prices','候補選択は「自動単価」'].forEach(text=>expect(estimate.includes(text),`推奨単価マスタ連動が見つかりません: ${text}`));
  ['onlineEditorsStatus','同時編集中：','save_project_bundle','conflictDraftButton'].forEach(text=>expect(estimate.includes(text),`同時編集の表示・競合保護が見つかりません: ${text}`));
  expect(estimate.includes('moveEstimateMemoToNextPageIfNeeded')&&estimate.includes('estimate-memo-block'),`見積メモを途中分断しない改ページ処理が見つかりません`);
  expect(estimate.includes('客先単価')&&estimate.includes('客先金額'),`見積表の客先向け金額表記が見つかりません`);
  expect(estimate.includes('<option value="人工"></option>'),`単位候補に「人工」が見つかりません`);
  expect((estimate.match(/list="estimateUnitOptions" data-f="unit"/g)||[]).length===3,`見積・発注・請求の単位自由入力欄が揃っていません`);
  expect(!estimate.includes('工事名称')&&estimate.includes('<span class="doc-meta-label">物件名：</span>')&&estimate.includes("s('p-kojiname',getDocumentPropertyName())"),`見積書の物件名と工事概要が分離されていません`);
  expect(estimate.includes('function getDocumentFileTitle(label)')&&estimate.includes('<title>${esc(getDocumentFileTitle(docLabel))}</title>'),`PDF保存名の帳票名重複防止が見つかりません`);
  ['showDirectoryPicker','showSaveFilePicker','ダウンロードごとに確認','ファイル名と保存先は、その保存画面で変更できます'].forEach(text=>expect(estimate.includes(text),`PC保存先選択の案内または処理が見つかりません: ${text}`));
  expect(estimate.includes('自社人工・自社資材は原価・粗利益の計算に含まれます'),`自社原価の注意書きが見つかりません`);
  expect(estimate.includes('自社原価共通.js')&&estimate.includes('costTable:window.IzumiSelfCosts.normalize(ctData)'),`自社原価4枠が案件保存へ接続されていません`);
  expect(estimate.includes('referralFees:{')&&estimate.includes("if(d.referralFees&&typeof d.referralFees==='object'"),`紹介料1・2が案件保存・読込へ接続されていません`);
  expect(estimate.includes('const grossProfit=postedInvoiceExTax-costExTax-feeAmount')&&estimate.includes('sales_invoice_ex_tax:invoiceIssued?invoiceExTax'),`紹介料が請求売上を変えず粗利益へ反映される契約が見つかりません`);
  expect(estimate.includes("heading:'利益の構成'")&&estimate.includes("heading:'請求利益の構成'")&&estimate.includes('profitFlowHtml({'),`見積・請求の利益構成が共通カード表示へ接続されていません`);
  expect((estimate.match(/data-self-cost-slot=/g)||[]).length===4&&(estimate.match(/data-self-cost-gross=/g)||[]).length===4&&(estimate.match(/data-self-cost-name=/g)||[]).length===4,`自社人工・自社資材の税抜／税込／名前4枠が見つかりません`);
  expect(estimate.includes('gridCoreCT.normalizeRange')&&estimate.includes('gridCoreCT.planPaste'),`売上原価管理表が共通表入力へ接続されていません`);
  expect(ledger.includes('window.IzumiGridCore'),`台帳が共通表入力へ接続されていません`);
  expect(ledger.includes('IzumiLedgerDates?.isAtLeastMonthsOld')&&ledgerDates.includes('addCalendarMonths'),`未入金の3か月経過判定が見つかりません`);
  expect(fiscalYear.includes('fiscalEndYearForDate')&&fiscalYear.includes('futureYears=3'),`年度候補の自動更新ロジックが見つかりません`);
  ['管理番号台帳.html','工事リスト・原価.html','工事リスト・未発注.html','請求.html','会議用案件一覧.html'].forEach(file=>{
    expect(read(file).includes('表入力共通.js'),`${file} が共通表入力を読み込んでいません`);
    expect(read(file).includes('年度共通.js'),`${file} が年度自動更新を読み込んでいません`);
  });
  ['sync_ledger_inputs_to_estimate','台帳入力を見積正本へ反映','p_vendor_name'].forEach(text=>expect(ledgerWritebackSql.includes(text),`台帳から正本への書戻し定義が見つかりません: ${text}`));
  const demoMirrorFiles=readdirSync('demo').filter(file=>/\.(?:html|js|css)$/.test(file));
  const demoBundle=[...demoMirrorFiles.map(file=>read(`demo/${file}`)),demoEstimateHtml,demoEstimateStandalone,demoEstimateIntegration].join('\n');
  expect(!demoBundle.includes('jjowjnrsknmakcunblzq')&&!demoBundle.includes('@supabase/supabase-js'),`販売先デモが本番Supabaseへ接続しています`);
  expect(demoEstimateHtml.includes("const MANAGEMENT_SUPABASE_URL=''")&&demoEstimateHtml.includes('const managementDb=null'),`デモ見積システムのSupabase接続が無効ではありません`);
  expect(!demoBundle.includes('@izumisoubi.co.jp')&&!demoBundle.includes('T7011601015057'),`販売先デモに本番の社員メールまたは適格請求書番号が残っています`);
  expect(demoEstimateIntegration.includes('izumi_sales_demo_estimate_project_v3_')&&demoEstimateIntegration.includes('DEMO')&&demoEstimateIntegration.includes('業務利用不可'),`デモ見積の案件別保存または印刷透かしが見つかりません`);
  expect(demoEstimateIntegration.includes("projects[0].managementNo")&&demoEstimateIntegration.includes('project.lines.map'),`20件のデモ案件が見積システムへ接続されていません`);
  expect(demoHtml.includes('一覧メニュー')&&demoHtml.includes('見積・発注・原価・請求')&&demoHtml.includes('href="estimate.html"'),`販売先デモの一覧メニューまたは見積導線がありません`);
  expect(demoEstimateHtml.includes('見積/発注/原価/管理請求システム')&&demoEstimateHtml.includes('profit-flow')&&demoEstimateHtml.includes('自社原価の内訳'),`デモ見積が現行版の画面構造を引き継いでいません`);
  const unsafeDemoStorage=[...demoEstimateHtml.matchAll(/localStorage\.(?:getItem|setItem|removeItem)\(\s*(['"])([^'"]+)\1/g)]
    .map(match=>match[2]).filter(key=>!key.startsWith('izumi_sales_demo_estimate_'));
  expect(unsafeDemoStorage.length===0,`デモ見積に本番と衝突するlocalStorageキーがあります: ${unsafeDemoStorage.join(', ')}`);
  ['DEMO・架空データ','demo-watermark','IZUMI_SALES_DEMO={reset()'].forEach(text=>expect(demoRuntimeSource.includes(text),`デモの識別表示または初期化機能が見つかりません: ${text}`));
  expect(!demoHtml.includes('data-locked')&&!demoEstimateIntegration.includes('LOCKED_TABS')&&!demoEstimateIntegration.includes('lockMasterTabs'),`販売先デモに操作ブロックが残っています`);
  ['管理番号取得.html','calendar.html','管理番号台帳.html','工事リスト・未発注.html','工事リスト・原価.html','請求.html','会議用案件一覧.html','銀行入金照合.html','支払通知書.html','変更注文・締め管理.html','システム管理.html'].forEach(file=>expect(demoHtml.includes(`href="${file}"`),`販売先デモの一覧メニューに操作画面がありません: ${file}`));
  ['class FakeQuery','issue_management_number_v2','save_project_manual_override','create_payment_notice_draft','bank_transactions','audit_log'].forEach(text=>expect(demoRuntimeSource.includes(text),`販売先デモの端末内データ処理が見つかりません: ${text}`));
  expect(demoEstimateIntegration.includes('syncSharedProject(data)')&&demoEstimateIntegration.includes('SHARED_PROJECTS_KEY'),`デモ見積から共通台帳への連動がありません`);
  ['東京建物不動産販売株式会社','株式会社イズミ装美','@izumisoubi.co.jp','ヒューリック目黒三田','東京都中央区日本橋浜町2-16-5'].forEach(text=>expect(!demoBundle.includes(text),`販売先デモに本番由来の情報が残っています: ${text}`));
  try{
    delete globalThis.IZUMI_DEMO_DATA;
    const data=Function(`${demoDataSource}; return globalThis.IZUMI_DEMO_DATA;`)();
    expect(data?.projects?.length===20,`販売先デモの案件が20件ではありません`);
    expect(new Set(data?.projects?.map(project=>project.managementNo)).size===20,`販売先デモの管理番号が重複しています`);
    const requiredDemoFields=['managementNo','receptionDate','staff','customer','customerContact','property','room','work','address','phone','status','salesEx','costEx','grossProfit','vendor','note'];
    data?.projects?.forEach((project,index)=>{
      requiredDemoFields.forEach(field=>expect(project[field]!==''&&project[field]!==null&&project[field]!==undefined,`デモ案件${index+1}の${field}が未入力です`));
      expect(project.lines?.length===4,`デモ案件${index+1}の明細が4行ではありません`);
      expect(project.lines?.every(line=>line.name&&line.spec&&line.quantity>0&&line.unit&&line.customerAmount>0&&line.costAmount>0&&line.vendor&&line.ordered&&line.note),`デモ案件${index+1}の明細に未入力があります`);
      expect(project.lines?.reduce((sum,line)=>sum+line.customerAmount,0)===project.salesEx,`デモ案件${index+1}の見積明細合計が売上と一致しません`);
      expect(project.lines?.reduce((sum,line)=>sum+line.costAmount,0)===project.costEx,`デモ案件${index+1}の原価明細合計が原価と一致しません`);
      expect(project.tax===Math.round(project.salesEx*.1)&&project.salesIn===project.salesEx+project.tax,`デモ案件${index+1}の消費税計算が一致しません`);
      expect(project.grossProfit===project.salesEx-project.costEx-project.selfLabor-project.selfMaterial-project.referralFee,`デモ案件${index+1}の粗利益計算が一致しません`);
      expect(project.margin===Math.round(project.grossProfit/project.salesEx*1000)/10,`デモ案件${index+1}の利益率計算が一致しません`);
      expect((project.paymentStatus==='入金済')===(project.paidDate!=='未入金'),`デモ案件${index+1}の入金状態と入金日が一致しません`);
      expect((project.orderStatus==='発注済')===(project.orderNo!=='未発行'),`デモ案件${index+1}の発注状態と発注番号が一致しません`);
      if(project.status==='入金済')expect(project.invoiceDate!=='未発行'&&project.completedDate!=='未完了'&&project.paidDate!=='未入金',`デモ案件${index+1}の入金済フローが未完了です`);
      if(project.status==='請求済')expect(project.invoiceDate!=='未発行'&&project.completedDate!=='未完了',`デモ案件${index+1}の請求済フローが未完了です`);
      if(project.status==='工事完了')expect(project.completedDate!=='未完了',`デモ案件${index+1}の完了日がありません`);
      if(['工事中','工事完了','請求済','入金済'].includes(project.status))expect(project.startDate!=='未定'&&project.endDate!=='未定',`デモ案件${index+1}の工期がありません`);
    });
    delete globalThis.IZUMI_DEMO_DATA;
  }catch(error){expect(false,`販売先デモの20案件を検証できません: ${error.message}`)}

  const gridSyntax=spawnSync(process.execPath,['--check','表入力共通.js'],{encoding:'utf8'});
  expect(gridSyntax.status===0,`表入力共通.jsの構文エラー: ${gridSyntax.stderr}`);
  const estimateMathSyntax=spawnSync(process.execPath,['--check','見積計算共通.js'],{encoding:'utf8'});
  expect(estimateMathSyntax.status===0,`見積計算共通.jsの構文エラー: ${estimateMathSyntax.stderr}`);
  const selfCostsSyntax=spawnSync(process.execPath,['--check','自社原価共通.js'],{encoding:'utf8'});
  expect(selfCostsSyntax.status===0,`自社原価共通.jsの構文エラー: ${selfCostsSyntax.stderr}`);
  const backupCoreSyntax=spawnSync(process.execPath,['--check','バックアップ共通.js'],{encoding:'utf8'});
  expect(backupCoreSyntax.status===0,`バックアップ共通.jsの構文エラー: ${backupCoreSyntax.stderr}`);
  const authSessionSyntax=spawnSync(process.execPath,['--check','認証セッション共通.js'],{encoding:'utf8'});
  expect(authSessionSyntax.status===0,`認証セッション共通.jsの構文エラー: ${authSessionSyntax.stderr}`);
  const demoRuntimeSyntax=spawnSync(process.execPath,['--check','demo/demo-runtime.js'],{encoding:'utf8'});
  expect(demoRuntimeSyntax.status===0,`demo/demo-runtime.jsの構文エラー: ${demoRuntimeSyntax.stderr}`);
  const demoDataSyntax=spawnSync(process.execPath,['--check','demo/demo-data.js'],{encoding:'utf8'});
  expect(demoDataSyntax.status===0,`demo/demo-data.jsの構文エラー: ${demoDataSyntax.stderr}`);
  const demoBuilderSyntax=spawnSync(process.execPath,['--check','scripts/build-demo-mirror.mjs'],{encoding:'utf8'});
  expect(demoBuilderSyntax.status===0,`scripts/build-demo-mirror.mjsの構文エラー: ${demoBuilderSyntax.stderr}`);
  const demoEstimateStandaloneSyntax=spawnSync(process.execPath,['--check','demo/estimate/standalone.js'],{encoding:'utf8'});
  expect(demoEstimateStandaloneSyntax.status===0,`demo/estimate/standalone.jsの構文エラー: ${demoEstimateStandaloneSyntax.stderr}`);
  const demoEstimateIntegrationSyntax=spawnSync(process.execPath,['--check','demo/estimate/demo-integration.js'],{encoding:'utf8'});
  expect(demoEstimateIntegrationSyntax.status===0,`demo/estimate/demo-integration.jsの構文エラー: ${demoEstimateIntegrationSyntax.stderr}`);
  const demoEstimateScripts=[...demoEstimateHtml.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(match=>match[1]).join('\n;\n');
  const demoEstimateTemporary='/tmp/izumi-demo-estimate-release-check.js';
  writeFileSync(demoEstimateTemporary,demoEstimateScripts);
  const demoEstimateSyntax=spawnSync(process.execPath,['--check',demoEstimateTemporary],{encoding:'utf8'});
  rmSync(demoEstimateTemporary,{force:true});
  expect(demoEstimateSyntax.status===0,`demo/estimate/index.html内JavaScriptの構文エラー: ${demoEstimateSyntax.stderr}`);
  const fiscalYearSyntax=spawnSync(process.execPath,['--check','年度共通.js'],{encoding:'utf8'});
  expect(fiscalYearSyntax.status===0,`年度共通.jsの構文エラー: ${fiscalYearSyntax.stderr}`);
  const ledgerSyntax=spawnSync(process.execPath,['--check','台帳共通.js'],{encoding:'utf8'});
  expect(ledgerSyntax.status===0,`台帳共通.jsの構文エラー: ${ledgerSyntax.stderr}`);
  const scripts=[...estimate.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(match=>match[1]).join('\n;\n');
  const temporary='/tmp/izumi-estimate-release-check.js';
  writeFileSync(temporary,scripts);
  const estimateSyntax=spawnSync(process.execPath,['--check',temporary],{encoding:'utf8'});
  rmSync(temporary,{force:true});
  expect(estimateSyntax.status===0,`estimate.html内JavaScriptの構文エラー: ${estimateSyntax.stderr}`);
  const calendarScripts=[...calendar.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(match=>match[1]).join('\n;\n');
  const calendarTemporary='/tmp/izumi-calendar-release-check.js';
  writeFileSync(calendarTemporary,calendarScripts);
  const calendarSyntax=spawnSync(process.execPath,['--check',calendarTemporary],{encoding:'utf8'});
  rmSync(calendarTemporary,{force:true});
  expect(calendarSyntax.status===0,`calendar.html内JavaScriptの構文エラー: ${calendarSyntax.stderr}`);
  try{
    const slotStart=calendar.indexOf('function normalizeDisplaySlot');
    const slotEnd=calendar.indexOf('function attendanceForDate',slotStart);
    const slotBuilder=Function(`${calendar.slice(slotStart,slotEnd)}; return {normalizeDisplaySlot,positionCalendarEvents};`)();
    const positioned=slotBuilder.positionCalendarEvents([{id:'first',display_slot:0},{id:'fourth',display_slot:3}]);
    expect(positioned.length===4&&positioned[0]?.id==='first'&&!positioned[1]&&!positioned[2]&&positioned[3]?.id==='fourth','空白行を含むカレンダー行位置を保持できません');
    const withUnslotted=slotBuilder.positionCalendarEvents([{id:'unslotted',display_slot:null},{id:'third',display_slot:2}]);
    expect(withUnslotted[0]?.id==='unslotted'&&withUnslotted[2]?.id==='third','行番号未設定の既存予定を安全に配置できません');
  }catch(error){expect(false,`カレンダーの行位置固定を検証できません: ${error.message}`)}
  try{
    const authViewStart=calendar.indexOf('function setAuthView');
    const authViewEnd=calendar.indexOf('function revealLogin',authViewStart);
    const nodes=Object.fromEntries(['loginCard','app','userBox'].map(id=>[id,{classes:new Set(['hidden'])}]));
    Object.values(nodes).forEach(node=>node.classList={
      toggle(name,force){if(force)node.classes.add(name);else node.classes.delete(name)},
      contains(name){return node.classes.has(name)}
    });
    const documentMock={body:{dataset:{}}};
    const setAuthView=Function('document','$',`${calendar.slice(authViewStart,authViewEnd)}; return setAuthView;`)(documentMock,id=>nodes[id]);
    setAuthView('app');
    expect(nodes.loginCard.classes.has('hidden')&&!nodes.app.classes.has('hidden')&&!nodes.userBox.classes.has('hidden'),'ログイン済み画面の排他表示が不正です');
    setAuthView('login');
    expect(!nodes.loginCard.classes.has('hidden')&&nodes.app.classes.has('hidden')&&nodes.userBox.classes.has('hidden'),'ログイン画面と本画面が同時表示される可能性があります');
  }catch(error){expect(false,`カレンダーの認証画面切替を検証できません: ${error.message}`)}
  try{
    const returnStatusStart=calendar.indexOf('function explicitReturnStatus');
    const returnStatusEnd=calendar.indexOf('function render(',returnStatusStart);
    expect(returnStatusStart>=0&&returnStatusEnd>returnStatusStart,'帰社・状況の表示判定関数が見つかりません');
    const returnStatusBuilder=Function(`${calendar.slice(returnStatusStart,returnStatusEnd)}; return {explicitReturnStatus,calendarReturnStatus};`)();
    expect(returnStatusBuilder.calendarReturnStatus({event_status:'予定'})==='','予定が帰社・状況欄へ自動表示されています');
    expect(returnStatusBuilder.calendarReturnStatus({return_status_text:'予定',event_status:'予定'})==='','保存済みの予定が帰社・状況欄へ表示されています');
    expect(returnStatusBuilder.calendarReturnStatus({return_status_text:'帰社済',event_status:'予定'})==='帰社済','手入力した帰社・状況が表示されません');
    expect(returnStatusBuilder.calendarReturnStatus({end_time:'17:30:00',event_status:'予定'})==='17:30','終了時刻が帰社・状況欄へ表示されません');
    expect(returnStatusBuilder.calendarReturnStatus({event_status:'工事中'})==='工事中','予定以外の有効な状況が表示されません');
    expect(calendar.includes("setTimeSelect('endTime',explicitReturnStatus(event)||event.end_time?.slice(0,5)||'')"),'詳細編集時に予定が帰社・状況へ再入力される可能性があります');
  }catch(error){expect(false,`カレンダーの帰社・状況表示を検証できません: ${error.message}`)}
  try{
    const holidayStart=calendar.indexOf('function japaneseHolidayMap');
    const holidayEnd=calendar.indexOf('function readDayRows',holidayStart);
    const isoDate=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    const holidayBuilder=Function('isoDate',`${calendar.slice(holidayStart,holidayEnd)}; return japaneseHolidayMap;`)(isoDate);
    const holidays2026=holidayBuilder(2026);
    [['2026-05-06','振替休日'],['2026-07-20','海の日'],['2026-09-22','国民の休日'],['2026-10-12','スポーツの日']].forEach(([date,name])=>expect(holidays2026.get(date)===name,`2026年の祝日判定が不正です: ${date} ${name}`));
  }catch(error){expect(false,`カレンダーの祝日判定を検証できません: ${error.message}`)}
  if(existsSync('tests')){
    const nodeTestFiles=readdirSync('tests').filter(file=>file.endsWith('.test.mjs')).map(file=>`tests/${file}`);
    if(nodeTestFiles.length){
      const tests=spawnSync(process.execPath,['--test',...nodeTestFiles],{encoding:'utf8'});
      expect(tests.status===0,`自動テストに失敗しました: ${tests.stdout}\n${tests.stderr}`);
    }
    const scriptTestFiles=readdirSync('tests').filter(file=>file.endsWith('.test.js')).map(file=>`tests/${file}`);
    scriptTestFiles.forEach(file=>{
      const test=spawnSync(process.execPath,[file],{encoding:'utf8'});
      expect(test.status===0,`${file} に失敗しました: ${test.stdout}\n${test.stderr}`);
    });
  }
}

if(failures.length){
  console.error('リリース確認に失敗しました。');
  failures.forEach(message=>console.error(`- ${message}`));
  process.exit(1);
}
console.log('リリース確認に合格しました。');

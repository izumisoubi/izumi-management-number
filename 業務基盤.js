const FLOW_STAGES=['受注','立会','見積','発注','完工','請求','入金'];
const normalizeNumber=value=>String(value??'').replace(/[０-９．，－]/g,ch=>({'０':0,'１':1,'２':2,'３':3,'４':4,'５':5,'６':6,'７':7,'８':8,'９':9,'．':'.','，':'','－':'-'}[ch])).replace(/,/g,'').trim();
const effectiveValue=(autoValue,manualValue)=>manualValue===null||manualValue===undefined?autoValue:manualValue;
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function downloadJson(name,data){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url)}
function exportLegacySnapshot(){
  const keys=['izumi_ordrows_v1','izumi_vendors_v3','izumi_costtable_v1'];
  const data={exported_at:new Date().toISOString(),device_id:localStorage.getItem('izumi_device_id')||crypto.randomUUID(),source:location.href,items:{}};
  localStorage.setItem('izumi_device_id',data.device_id);
  keys.forEach(key=>{try{data.items[key]=JSON.parse(localStorage.getItem(key)||'null')}catch{data.items[key]={parse_error:true,raw:localStorage.getItem(key)}}});
  downloadJson(`イズミ装美_移行前バックアップ_${new Date().toLocaleDateString('sv-SE')}.json`,data);
  return data;
}
function previewImport(file,onReady){
  const reader=new FileReader();reader.onload=()=>{try{const parsed=JSON.parse(reader.result);onReady(null,parsed)}catch(error){onReady(error)}};reader.readAsText(file);
}

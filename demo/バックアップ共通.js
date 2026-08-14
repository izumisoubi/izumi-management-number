(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.IzumiBackup=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const ARRAY_KEYS=['rows','ordRows','invRows','vendors'];
  const OBJECT_KEYS=['basic','companies','costTable','referralFees','invOv','ledger','ledgerWriteback'];
  const NUMERIC_ROW_KEYS=['qty','cost','orderCost','sellOverride','landlordRate','tenantRate','landlordTaxIn','tenantTaxIn'];

  function isPlainObject(value){
    return !!value&&typeof value==='object'&&!Array.isArray(value);
  }

  function validateRow(row,index,key){
    if(!isPlainObject(row))throw new Error(`${key}[${index}] が正しい行データではありません`);
    if(row.type!==undefined&&!['item','section','discount'].includes(String(row.type))){
      throw new Error(`${key}[${index}] の行種別が不正です`);
    }
    for(const field of NUMERIC_ROW_KEYS){
      const value=row[field];
      if(value===undefined||value===null||value==='')continue;
      if(typeof value!=='number'&&typeof value!=='string')throw new Error(`${key}[${index}].${field} が数値ではありません`);
    }
  }

  function parseAndValidate(text){
    let data;
    try{data=JSON.parse(String(text||''));}
    catch(_error){throw new Error('JSONの形式が正しくありません');}
    if(!isPlainObject(data))throw new Error('バックアップの内容が正しくありません');
    const coreKeys=['rows','basic','companies','ordRows','invRows','costTable'];
    if(!coreKeys.some(key=>Object.prototype.hasOwnProperty.call(data,key))){
      throw new Error('見積システムのバックアップではありません');
    }
    for(const key of ARRAY_KEYS){
      if(data[key]===undefined)continue;
      if(!Array.isArray(data[key]))throw new Error(`${key} が配列ではありません`);
      if(data[key].length>10000)throw new Error(`${key} の件数が多すぎます`);
    }
    for(const key of OBJECT_KEYS){
      if(data[key]!==undefined&&!isPlainObject(data[key]))throw new Error(`${key} が正しい形式ではありません`);
    }
    ['rows','ordRows','invRows'].forEach(key=>(data[key]||[]).forEach((row,index)=>validateRow(row,index,key)));
    return data;
  }

  return Object.freeze({version:'1.0.0',parseAndValidate});
});

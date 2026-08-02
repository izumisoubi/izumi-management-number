(function(root){
  'use strict';
  const trim=value=>String(value??'').replace(/\u3000/g,' ').trim();
  const halfDigits=value=>String(value??'').replace(/[０-９]/g,char=>String.fromCharCode(char.charCodeAt(0)-0xFEE0));
  const header=value=>trim(value).replace(/[\s_\-・（）()]/g,'').toLowerCase();
  const number=value=>Number(halfDigits(trim(value)).replace(/[,，\s¥￥]/g,''));
  function parseCsv(text){
    const rows=[];let row=[],cell='',quoted=false;
    for(let i=0;i<String(text).length;i++){
      const char=text[i],next=text[i+1];
      if(quoted){
        if(char==='"'&&next==='"'){cell+='"';i++}
        else if(char==='"')quoted=false;
        else cell+=char;
      }else if(char==='"')quoted=true;
      else if(char===','){row.push(cell);cell=''}
      else if(char==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell=''}
      else cell+=char;
    }
    if(cell.length||row.length){row.push(cell.replace(/\r$/,''));rows.push(row)}
    return rows.filter(values=>values.some(value=>trim(value)!==''));
  }
  function bankDate(value){
    const digits=halfDigits(trim(value)).replace(/\D/g,'');
    if(digits.length===8)return `${digits.slice(0,4)}-${digits.slice(4,6)}-${digits.slice(6,8)}`;
    if(digits.length!==6)return '';
    const yy=Number(digits.slice(0,2)),year=yy<=79?2000+yy:1900+yy;
    return `${year}-${digits.slice(2,4)}-${digits.slice(4,6)}`;
  }
  function valueAt(row,map,names){
    for(const name of names){const index=map.get(header(name));if(index!==undefined)return trim(row[index])}
    return '';
  }
  function parseHeaderRows(rows,bankHint){
    const headerIndex=rows.findIndex(row=>{
      const keys=new Set(row.map(header));
      return (keys.has(header('取引金額'))||keys.has(header('金額')))
        &&(keys.has(header('取引日'))||keys.has(header('勘定日'))||keys.has(header('預入・払出日')));
    });
    if(headerIndex<0)return null;
    const names=rows[headerIndex],map=new Map(names.map((name,index)=>[header(name),index]));
    const bankCode=halfDigits(valueAt(rows[headerIndex+1]||[],map,['金融機関コード','銀行コード']))||bankHint||'';
    const parsed=[];
    const sourceRows=rows.slice(headerIndex+1);
    sourceRows.forEach((row,index)=>{
      const amount=number(valueAt(row,map,['取引金額','金額','入金額']));
      const directionRaw=halfDigits(valueAt(row,map,['入払区分','入出金区分']));
      const direction=/^(1|入金|預入)$/.test(directionRaw)?'credit':/^(2|出金|払出)$/.test(directionRaw)?'debit':'';
      const transactionDate=bankDate(valueAt(row,map,['取引日','勘定日','預入・払出日','預入払出日']));
      if(!transactionDate||!Number.isFinite(amount)||amount<=0||!direction)return;
      parsed.push({
        source_row_no:headerIndex+index+2,transaction_date:transactionDate,direction,amount,
        payer_name:valueAt(row,map,['振込依頼人名','振込依頼人名または契約者番号','依頼人名','摘要名']),
        description:valueAt(row,map,['摘要','摘要内容','取引内容']),
        edi_info:valueAt(row,map,['EDI情報','ＥＤＩ情報']),
        source_reference:valueAt(row,map,['照会番号','取引番号','振込依頼人番号']),
        raw_data:Object.fromEntries(names.map((name,i)=>[trim(name)||`列${i+1}`,trim(row[i])]))
      });
    });
    return{bank_code:bankCode||bankHint||'',format:'header_csv',rows:parsed,
      source_row_count:sourceRows.length,skipped_count:sourceRows.length-parsed.length};
  }
  function parseZenginRows(rows,bankHint){
    const fileHeader=rows.find(row=>trim(row[0])==='1');
    const serviceCode=halfDigits(trim(fileHeader?.[1]));
    if(!['01','03'].includes(serviceCode))return null;
    const bankCode=halfDigits(trim(fileHeader?.[6]))||bankHint||'';
    const parsed=[],sourceRows=rows.filter(row=>trim(row[0])==='2');
    rows.forEach((row,index)=>{
      if(trim(row[0])!=='2')return;
      let transactionDate='',direction='credit',amount=0,payerName='',description='',edi='',reference='';
      if(serviceCode==='03'){
        transactionDate=bankDate(row[3]||row[2]);direction=halfDigits(trim(row[4]))==='2'?'debit':'credit';
        amount=number(row[6]);reference=trim(row[1]);payerName=trim(row[14]);description=trim(row[17]);edi=trim(row[18]);
      }else{
        transactionDate=bankDate(row[3]||row[2]);amount=number(row[4]);reference=trim(row[1]);
        payerName=trim(row[7]);description=[trim(row[8]),trim(row[9])].filter(Boolean).join(' ');edi=trim(row[11]);
      }
      if(!transactionDate||!Number.isFinite(amount)||amount<=0)return;
      parsed.push({source_row_no:index+1,transaction_date:transactionDate,direction,amount,payer_name:payerName,
        description,edi_info:edi,source_reference:reference,raw_data:{columns:row.map(trim),service_code:serviceCode}});
    });
    return{bank_code:bankCode||bankHint||'',format:serviceCode==='03'?'zengin_account_activity_csv':'zengin_credit_notice_csv',rows:parsed,
      source_row_count:sourceRows.length,skipped_count:sourceRows.length-parsed.length};
  }
  function parseBankCsv(text,bankHint=''){
    const rows=parseCsv(String(text).replace(/^\uFEFF/,''));
    if(!rows.length)throw new Error('CSVに明細がありません');
    const result=parseHeaderRows(rows,bankHint)||parseZenginRows(rows,bankHint);
    if(!result||!result.rows.length)throw new Error('対応する入出金明細CSVを判定できません。MUFG BizSTATIONまたはSMBC Web21のCSVを選択してください。');
    if(!['0005','0009'].includes(result.bank_code))result.bank_code=bankHint||result.bank_code;
    result.bank_name=result.bank_code==='0005'?'三菱UFJ銀行':result.bank_code==='0009'?'三井住友銀行':'銀行未判定';
    return result;
  }
  function decodeBankFile(buffer){
    const bytes=new Uint8Array(buffer);
    const utf8=new TextDecoder('utf-8',{fatal:false}).decode(bytes);
    const utf8Errors=(utf8.match(/\uFFFD/g)||[]).length;
    const sjis=new TextDecoder('shift_jis',{fatal:false}).decode(bytes);
    const sjisErrors=(sjis.match(/\uFFFD/g)||[]).length;
    const utf8Japanese=(utf8.match(/[ぁ-んァ-ヶ一-龠]/g)||[]).length;
    const sjisJapanese=(sjis.match(/[ぁ-んァ-ヶ一-龠]/g)||[]).length;
    return utf8Errors<sjisErrors||utf8Japanese>=sjisJapanese?{text:utf8,encoding:'UTF-8'}:{text:sjis,encoding:'Shift_JIS'};
  }
  function testSamples(){
    const mufg='金融機関コード,金融機関名,支店コード,支店名,科目,口座番号,口座名,取引日,入払区分,取引区分,取引金額,内他店券金額,手形・小切手区分,手形・小切手番号,振込依頼人番号,振込依頼人名,仕向金融機関名,仕向支店名,摘要,EDI情報\n0005,ﾐﾂﾋﾞｼﾕ-ｴﾌｼﾞｴｲ,001,ﾎﾝｺﾞｳ,1,0000015583,ｶ)ｲｽﾞﾐｿｳﾋﾞ,260724,1,11,330000,0,,,123,ｶ)ﾃｽﾄ,ﾐﾂｲｽﾐﾄﾓ,ｱｻｸｻﾊﾞｼ,ﾌﾘｺﾐ,ABC';
    const smbc='1,03,0,260724,260701,260724,0009,ﾐﾂｲｽﾐﾄﾓ,001,ﾄｳｷﾖｳ,0,1,0007476760,ｶ)ｲｽﾞﾐｿｳﾋﾞ,,,,\n2,1001,260724,260724,1,11,550000,0,,,,,,999,ｶ)ｻﾝﾌﾟﾙ,ﾐﾂﾋﾞｼUFJ,ﾎﾝｺﾞｳ,ﾌﾘｺﾐ,EDI001,';
    const a=parseBankCsv(mufg),b=parseBankCsv(smbc);
    return a.bank_code==='0005'&&a.rows[0].amount===330000&&a.rows[0].direction==='credit'
      &&b.bank_code==='0009'&&b.rows[0].amount===550000&&b.rows[0].payer_name==='ｶ)ｻﾝﾌﾟﾙ';
  }
  root.IzumiBankParser={parseCsv,parseBankCsv,decodeBankFile,bankDate,testSamples};
})(typeof window!=='undefined'?window:globalThis);

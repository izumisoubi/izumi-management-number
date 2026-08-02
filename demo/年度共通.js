(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.IzumiFiscalYear=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const START_MONTH=9;
  function dateParts(value){
    if(value instanceof Date&&!Number.isNaN(value.getTime())){
      return {year:value.getFullYear(),month:value.getMonth()+1};
    }
    const match=String(value||'').match(/^(\d{4})[-/](\d{1,2})/);
    if(!match)return null;
    const year=Number(match[1]),month=Number(match[2]);
    return month>=1&&month<=12?{year,month}:null;
  }
  function fiscalEndYearForDate(value=new Date()){
    const parts=dateParts(value);
    if(!parts)return 0;
    return parts.year+(parts.month>=START_MONTH?1:0);
  }
  function codeForDate(value=new Date()){
    const year=fiscalEndYearForDate(value);
    return year?String(year).slice(-2).padStart(2,'0'):'';
  }
  function labelForCode(code){
    const number=Number(String(code||'').replace(/\D/g,''));
    return Number.isFinite(number)&&number>0?`${2000+(number%100)}年度`:'';
  }
  function accountingYearForDate(value){
    const year=fiscalEndYearForDate(value);
    return year?`${year}年度`:'';
  }
  function options({today=new Date(),minimumCode=22,pastYears=6,futureYears=3,includeCodes=[]}={}){
    const current=Number(codeForDate(today));
    const minimum=Math.min(minimumCode,...includeCodes.map(Number).filter(Number.isFinite));
    const maximum=Math.max(current+futureYears,...includeCodes.map(Number).filter(Number.isFinite));
    const result=[];
    for(let code=maximum;code>=minimum;code-=1){
      const normalized=String(code).padStart(2,'0');
      result.push({code:normalized,label:labelForCode(normalized)});
    }
    return result;
  }
  function fiscalCalendarYear(code,month){
    const numericCode=Number(code),numericMonth=Number(month);
    return 2000+numericCode-(numericMonth>=START_MONTH?1:0);
  }
  return {START_MONTH,dateParts,fiscalEndYearForDate,codeForDate,labelForCode,accountingYearForDate,options,fiscalCalendarYear};
});

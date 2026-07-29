(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.IzumiLedgerDates=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function dateParts(value){
    const match=String(value||'').match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if(!match)return null;
    const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
    if(month<1||month>12||day<1||day>31)return null;
    return {year,month,day};
  }

  function dateKey(parts){
    return parts.year*10000+parts.month*100+parts.day;
  }

  function addCalendarMonths(value,months){
    const source=dateParts(value);
    if(!source)return '';
    const serial=source.year*12+(source.month-1)+Number(months||0);
    const year=Math.floor(serial/12);
    const month=serial-year*12+1;
    const lastDay=new Date(Date.UTC(year,month,0)).getUTCDate();
    const day=Math.min(source.day,lastDay);
    return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }

  function todayParts(now){
    if(typeof now==='string')return dateParts(now);
    const date=now instanceof Date?now:new Date();
    return {year:date.getFullYear(),month:date.getMonth()+1,day:date.getDate()};
  }

  function isAtLeastMonthsOld(value,months,now){
    const due=dateParts(addCalendarMonths(value,months));
    const today=todayParts(now);
    return Boolean(due&&today&&dateKey(today)>=dateKey(due));
  }

  return {addCalendarMonths,isAtLeastMonthsOld};
});

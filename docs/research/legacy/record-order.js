(function(root) {
  'use strict';
  const collator = new Intl.Collator('zh-CN', {numeric:true,sensitivity:'base'});
  const groups = ['算法','网安','科研','思政','未分组'];
  function dateParts(value) {
    // No title-derived dates and no locale-dependent Date.parse for partial dates.
    const match = String(value || '').trim().match(/^(20\d{2})(?:[年.\/-](\d{1,2})(?!\d))?(?:[月.\/-](\d{1,2})(?!\d))?/);
    if (!match) return null;
    const year=Number(match[1]),month=Number(match[2] || 0),day=Number(match[3] || 0);
    if (month>12 || (match[2] && !month) || (match[3] && (!day || !month))) return null;
    if (day && new Date(Date.UTC(year,month-1,day)).getUTCDate()!==day) return null;
    return {year,month,day,key:year*10000+month*100+day};
  }
  function textCompare(a,b) { return collator.compare(String(a || ''),String(b || '')); }
  function compareDate(a,b,direction) {
    const x=dateParts(a.date),y=dateParts(b.date);
    if (!x || !y) return x?-1:y?1:0; // Unknown dates are last in both directions.
    return (x.key-y.key)*direction;
  }
  function compareRecords(a,b,sort='date-desc') {
    let result=0;
    const descending=sort.endsWith('-desc'),dir=descending?-1:1;
    if (sort.startsWith('date-')) result=compareDate(a,b,dir);
    else if (sort.startsWith('name-')) result=textCompare(a.title,b.title)*dir;
    else if (sort.startsWith('group-')) {
      const index=r=>{const i=groups.indexOf(r.group || '未分组');return i<0?groups.length:i;};
      result=(index(a)-index(b))*dir || compareDate(a,b,-1);
    } else if (sort==='updated-desc') {
      const x=Date.parse(a.updated_at),y=Date.parse(b.updated_at);
      result=(Number.isFinite(y)?y:0)-(Number.isFinite(x)?x:0);
    } else if (sort==='id-asc') result=textCompare(a.id,b.id);
    return result || textCompare(a.id,b.id);
  }
  function sortRecords(records,sort) { return [...records].sort((a,b)=>compareRecords(a,b,sort)); }
  function galleryBuckets(records,mode,sort) {
    const buckets=new Map();
    for (const record of records) {
      const d=dateParts(record.date);
      const key=mode==='group'?(record.group || '未分组'):d?String(d.year)+(d.month?'-'+String(d.month).padStart(2,'0'):''): 'unknown';
      if (!buckets.has(key)) buckets.set(key,{key,title:mode==='group'?key:d?`${d.year}年${d.month?' '+d.month+'月':'（月份未注明）'}`:'日期待补',records:[]});
      buckets.get(key).records.push(record);
    }
    const result=[...buckets.values()];
    result.sort((a,b)=>{
      if (mode==='group') return (groups.indexOf(a.key)-groups.indexOf(b.key))*(sort==='group-desc'?-1:1);
      if (a.key==='unknown' || b.key==='unknown') return a.key==='unknown'?1:-1;
      return textCompare(a.key,b.key)*(sort==='date-asc'?1:-1);
    });
    for (const bucket of result) bucket.records=sortRecords(bucket.records,sort);
    return result;
  }
  const api={dateParts,sortRecords,galleryBuckets};
  if (typeof module==='object' && module.exports) module.exports=api;
  else root.MaterialOrder=api;
})(typeof globalThis==='object'?globalThis:this);

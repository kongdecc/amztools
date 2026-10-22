// Local, deterministic parsing: uncertain components stay available for manual review.
function parseWarehouseAddress(value=''){
  let text=String(value).replace(/\r/g,'').replace(/[，；;]/g,',').trim();
  const result={};
  if(!text)return result;
  const labels={code:'仓库代码|仓库编码|warehouse code',address:'街道地址|详细地址|地址|street address|address',city:'城市|city',state:'州 / 省代码|州|省|state|province',postalCode:'邮编|邮政编码|postal code|zip code|zip',countryCode:'国家代码|country code',country:'国家|country',region:'地区|region'};
  const labelPattern=Object.values(labels).join('|');
  const labeled=new RegExp(`(${labelPattern})\\s*[:：]\\s*([\\s\\S]*?)(?=(?:${labelPattern})\\s*[:：]|$)`,'gi');
  text=text.replace(labeled,(_,label,content)=>{
    const key=Object.keys(labels).find(key=>new RegExp(`^(?:${labels[key]})$`,'i').test(label));
    result[key]=content.replace(/^[,\s]+|[,\s]+$/g,'');return '';
  });
  const countries=[['US','美国','United States(?: of America)?|USA|US|美国'],['CA','加拿大','Canada|CA|加拿大'],['GB','英国','United Kingdom|UK|GB|英国'],['DE','德国','Germany|DE|德国'],['FR','法国','France|FR|法国'],['ES','西班牙','Spain|ES|西班牙'],['IT','意大利','Italy|IT|意大利'],['AU','澳大利亚','Australia|AU|澳大利亚'],['JP','日本','Japan|JP|日本'],['PL','波兰','Poland|PL|波兰']];
  let country=countries.find(([code,,pattern])=>code===String(result.countryCode||'').toUpperCase()||new RegExp(`^(?:${pattern})$`,'i').test(result.country||''));
  if(!country){
    for(const entry of countries){
      const suffix=new RegExp(`(?:^|[,\\s]+)(${entry[2]})\\s*$`,'i');
      if(suffix.test(text)){country=entry;text=text.replace(suffix,'').trim();break}
    }
  }
  const code=text.match(/^\s*(?:Amazon\s+)?([A-Z]{2,4}\d[A-Z0-9]?)(?=[\s,:()\-]|$)/i);
  if(code){result.code=result.code||code[1].toUpperCase();text=text.slice(code[0].length).replace(/^[\s,:()\-]+/,'')}
  text=text.replace(/\b([A-Z]{2})\s*,\s*(\d{5}(?:-\d{4})?|[A-Z]\d[A-Z]\s?\d[A-Z]\d)\b/gi,'$1 $2');
  const parts=text.split(/\n|,/).map(part=>part.trim()).filter(Boolean);
  let last=parts.pop()||'';
  let location=last.match(/^(.*?)\s*\b([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
  let inferred='US';
  if(!location){location=last.match(/^(.*?)\s*\b([A-Z]{2})\s+([A-Z]\d[A-Z]\s?\d[A-Z]\d)$/i);inferred='CA'}
  if(location&&(!country||country[0]===inferred)){
    result.state=result.state||location[2].toUpperCase();result.postalCode=result.postalCode||location[3].toUpperCase();
    result.city=result.city||location[1].trim()||parts.pop()||'';
    country=country||countries.find(entry=>entry[0]===inferred);
  }else{
    // UK postcodes and continental postal-code-before-city formats.
    const uk=last.match(/^(.*?)\s*\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})$/i);
    const eu=country&&['DE','FR','ES','IT','PL'].includes(country[0])&&last.match(/^(\d{2}-?\d{3})\s+(.+)$/);
    if(uk&&(!country||country[0]==='GB')){result.postalCode=result.postalCode||uk[2].toUpperCase();result.city=result.city||uk[1].trim()||parts.pop()||'';country=country||countries.find(entry=>entry[0]==='GB')}
    else if(eu){result.postalCode=result.postalCode||eu[1];result.city=result.city||eu[2]}
    else if(last)parts.push(last);
  }
  if(parts.length)result.address=result.address||parts.join(', ');
  if(country){result.countryCode=country[0];result.country=result.country||country[1]}
  if(result.code)result.code=result.code.toUpperCase();
  return Object.fromEntries(Object.entries(result).filter(([,value])=>value));
}

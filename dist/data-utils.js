export function parseCSV(text){
 const map=new Map();let dropped=0,duplicates=0;
 for(const line of text.trim().split(/\r?\n/).slice(1)){const [date,raw]=line.split(',');const value=Number(raw);if(!/^\d{4}-(0[1-9]|1[0-2])-01$/.test(date)||!raw?.trim()||!Number.isFinite(value)||value<=0){dropped++;continue}const month=date.slice(0,7);if(map.has(month))duplicates++;map.set(month,{date:month,value});}
 return {rows:[...map.values()].sort((a,b)=>a.date.localeCompare(b.date)),dropped,duplicates};
}
export function shiftMonth(date,delta){const [y,m]=date.split('-').map(Number);const d=new Date(Date.UTC(y,m-1+delta,1));return d.toISOString().slice(0,7)}
export function derive(rows){const map=new Map(rows.map(r=>[r.date,r.value]));const changes=new Map(rows.map(r=>{const p=map.get(shiftMonth(r.date,-1));return [r.date,p?100*(r.value/p-1):null]}));return rows.map(r=>{const prev=map.get(shiftMonth(r.date,-12));const window=Array.from({length:12},(_,i)=>changes.get(shiftMonth(r.date,-i)));let vol=null;if(window.every(v=>v!=null)){const mean=window.reduce((a,b)=>a+b,0)/12;vol=Math.sqrt(window.reduce((s,v)=>s+(v-mean)**2,0)/11)}return {...r,index:r.value,mom:changes.get(r.date),yoy:prev?100*(r.value/prev-1):null,vol}})}
export function completeMonths(rows){if(!rows.length)return [];const map=new Map(rows.map(r=>[r.date,r]));const result=[];for(let d=rows[0].date;d<=rows.at(-1).date;d=shiftMonth(d,1))result.push(map.get(d)||{date:d,index:null,mom:null,yoy:null,vol:null});return result;}

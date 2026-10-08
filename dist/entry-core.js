const EntryCore=(()=>{
 const frames=['Month','Week','Day','H4','H1','30','15','5'],entries=['แท่งเทียนกลับตัว','ซับเวฟฟอร์มตัว','MMโซน'],keys=['heroPlay','heroFrame','heroZone','heroEntry'];
 function valid(r){return [r.heroPlay,r.heroZone].every(v=>v==null||['','Yes','No'].includes(v))&&(r.heroEntry==null||['',...entries].includes(r.heroEntry))&&(r.heroPlay==='Yes'?frames.includes(r.heroFrame):r.heroFrame==null||r.heroFrame==='')}
 function fields(f){const r={heroPlay:f.heroPlay||'',heroFrame:f.heroPlay==='Yes'?f.heroFrame||'':'',heroZone:f.heroZone||'',heroEntry:f.heroEntry||''};if(!valid(r))throw Error('เลือก Timeframe พระเอกเมื่อเลือก Yes และตรวจเงื่อนไขเข้า Position');return r}
 function groups(rows,d){const trades=new Map(d.trades.map(t=>[t.id,t]));const items=rows.filter(r=>r.source==='Futures'&&!r.costOnly).map(r=>({...r,...Object.fromEntries(keys.map(k=>[k,trades.get(r.id)?.[k]||'']))}));const label=r=>[r.heroPlay||'ยังไม่ระบุ',r.heroPlay==='Yes'?r.heroFrame:'ไม่ใช้',r.heroZone||'ยังไม่ระบุ',r.heroEntry||'ยังไม่ระบุ'].join(' / ');return [
 ['เล่นบน Timeframe พระเอก',r=>r.heroPlay||'ยังไม่ระบุ',items],
 ['Timeframe ที่เป็นพระเอก (เฉพาะ Yes)',r=>r.heroFrame||'ยังไม่ระบุ',items.filter(r=>r.heroPlay==='Yes')],
 ['อยู่ในโซน ovb หรือ ovs',r=>r.heroZone||'ยังไม่ระบุ',items],
 ['การเข้า position',r=>r.heroEntry||'ยังไม่ระบุ',items],
 ['เงื่อนไขร่วม: พระเอก / Timeframe / โซน / การเข้า',label,items]
 ].map(([title,key,list])=>({title,groups:AnalyticsCore.groups(list,key)}))}
 return {frames,entries,keys,fields,valid,groups};
})();

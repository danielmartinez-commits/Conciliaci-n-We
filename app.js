const state = {
  rows: [], filtered: [], fileName: "", headers: []
};

const aliases = {
  journal: ["Journal No.","Journal No","Journal Number","Journal"],
  date: ["Journal Date","Date","Transaction Date"],
  invoice: ["Invoice","Invoice No.","Invoice Number"],
  account: ["Account","Account Name"],
  debit: ["Debit","Debits"],
  credit: ["Credit","Credits"],
  description: ["Description","Memo"],
  name: ["Name","Customer","Vendor"],
  client: ["Client","Client Name"],
  broker: ["Broker","Broker Name"],
  payment: ["Payment Method","Payment"],
  processed: ["Processed At","Processed"],
  batch: ["Batch ID","Batch"]
};

const $ = s => document.querySelector(s);
const money = n => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:2}).format(Number(n)||0);
const esc = v => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

function parseCSV(text){
  const rows=[]; let row=[], field="", quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i], next=text[i+1];
    if(c === '"'){
      if(quoted && next === '"'){field+='"';i++}
      else quoted=!quoted;
    } else if(c===',' && !quoted){row.push(field);field=""}
    else if((c==='\n'||c==='\r')&&!quoted){
      if(c==='\r'&&next==='\n')i++;
      row.push(field); field="";
      if(row.some(x=>x.trim()!=="")) rows.push(row);
      row=[];
    } else field+=c;
  }
  if(field!==""||row.length){row.push(field);if(row.some(x=>x.trim()!==""))rows.push(row)}
  return rows;
}
function parseNumber(v){
  if(v===null||v===undefined||String(v).trim()==="") return 0;
  let s=String(v).trim().replace(/\s/g,"");
  if(s.includes(",") && s.includes(".")) s=s.replace(/,/g,"");
  else if(s.includes(",") && !s.includes(".")) s=s.replace(",",".");
  s=s.replace(/[$€]/g,"");
  const n=Number(s.replace(/[^\d.-]/g,""));
  return Number.isFinite(n)?n:0;
}
function getField(obj, type){
  const keys=Object.keys(obj);
  const found=aliases[type].find(a=>keys.some(k=>k.trim().toLowerCase()===a.toLowerCase()));
  return found ? obj[keys.find(k=>k.trim().toLowerCase()===found.toLowerCase())] : "";
}
function normalize(headers, matrix){
  return matrix.map(r=>{
    const raw={}; headers.forEach((h,i)=>raw[h]=(r[i]??"").trim());
    return {
      raw, journal:String(getField(raw,"journal")).trim(), date:String(getField(raw,"date")).trim(),
      invoice:String(getField(raw,"invoice")).trim(), account:String(getField(raw,"account")).trim()||"Sin cuenta",
      debit:parseNumber(getField(raw,"debit")), credit:parseNumber(getField(raw,"credit")),
      description:String(getField(raw,"description")).trim(), name:String(getField(raw,"name")).trim(),
      client:String(getField(raw,"client")).trim()||String(getField(raw,"name")).trim()||"Sin cliente",
      broker:String(getField(raw,"broker")).trim()||"Sin broker", payment:String(getField(raw,"payment")).trim(),
      processed:String(getField(raw,"processed")).trim(), batch:String(getField(raw,"batch")).trim()
    };
  });
}
function uniqueSorted(arr){return [...new Set(arr.filter(Boolean))].sort((a,b)=>a.localeCompare(b));}

function loadCSV(file){
  const reader=new FileReader();
  reader.onload=()=>{
    let matrix=parseCSV(reader.result);
    if(!matrix.length){alert("El CSV está vacío.");return}
    const headers=matrix.shift().map(x=>x.trim());
    state.headers=headers; state.rows=normalize(headers,matrix); state.fileName=file.name;
    state.filtered=[...state.rows];
    $("#fileStatus").textContent=file.name;
    $("#emptyState").classList.add("hidden"); $("#dataDashboard").classList.remove("hidden");
    populateFilters(); applyFilters(); renderAll();
  };
  reader.readAsText(file,"UTF-8");
}
function populateFilters(){
  const fill=(sel,values,label)=>{const el=$(sel);el.innerHTML=`<option value="">${label}</option>`+uniqueSorted(values).map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("")};
  fill("#accountFilter",state.rows.map(r=>r.account),"Todas las cuentas");
  fill("#clientFilter",state.rows.map(r=>r.client),"Todos los clientes");
  fill("#brokerFilter",state.rows.map(r=>r.broker),"Todos los brokers");
}
function applyFilters(){
  const q=$("#globalSearch").value.trim().toLowerCase(), a=$("#accountFilter").value,c=$("#clientFilter").value,b=$("#brokerFilter").value;
  state.filtered=state.rows.filter(r=>{
    const hay=[r.journal,r.invoice,r.account,r.client,r.broker,r.name,r.description,r.batch].join(" ").toLowerCase();
    return (!q||hay.includes(q))&&(!a||r.account===a)&&(!c||r.client===c)&&(!b||r.broker===b);
  });
  renderAll();
}
function renderAll(){renderKpis();renderAccountCards();renderAccountsTable();renderMovementsTable();}
function renderKpis(){
  const rows=state.filtered, debit=rows.reduce((s,r)=>s+r.debit,0), credit=rows.reduce((s,r)=>s+r.credit,0);
  $("#kpiRows").textContent=rows.length.toLocaleString();
  $("#kpiInvoices").textContent=`${new Set(rows.map(r=>r.invoice).filter(Boolean)).size.toLocaleString()} facturas`;
  $("#kpiDebit").textContent=money(debit);$("#kpiCredit").textContent=money(credit);
  const diff=debit-credit;$("#kpiDifference").textContent=money(diff);$("#kpiDifference").className=diff===0?"balance-ok":"balance-open";
}
function groupBy(arr,key){return arr.reduce((m,x)=>(m.set(x[key],(m.get(x[key])||[]).concat(x)),m),new Map())}
function renderAccountCards(){
  const groups=groupBy(state.filtered,"account");
  $("#accountCards").innerHTML=[...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([account,rows])=>{
    const debit=rows.reduce((s,r)=>s+r.debit,0),credit=rows.reduce((s,r)=>s+r.credit,0);
    const clients=groupBy(rows,"client");
    const inner=[...clients.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([client,cr])=>{
      const d=cr.reduce((s,r)=>s+r.debit,0),c=cr.reduce((s,r)=>s+r.credit,0);
      const brokers=uniqueSorted(cr.map(r=>r.broker)).join(" • ");
      return `<div class="group"><div class="group-main" data-account="${esc(account)}" data-client="${esc(client)}"><div class="group-name"><strong>${esc(client)}</strong><span>${esc(brokers)} · ${cr.length} mov.</span></div><div class="group-values"><b>${money(d-c)}</b><span>D ${money(d)} · C ${money(c)}</span></div></div></div>`;
    }).join("");
    return `<article class="account-card"><div class="account-header"><strong>${esc(account)}</strong><div class="account-total"><small>SALDO NETO</small><strong>${money(debit-credit)}</strong></div></div>${inner}</article>`;
  }).join("")||`<div class="empty-state"><h2>Sin resultados</h2><p>Ajusta los filtros para continuar.</p></div>`;
  document.querySelectorAll(".group-main").forEach(el=>el.addEventListener("click",()=>openGroup(el.dataset.account,el.dataset.client)));
}
function openGroup(account,client){
  const rows=state.filtered.filter(r=>r.account===account&&r.client===client);
  $("#modalTitle").textContent=`${account} · ${client}`;
  const d=rows.reduce((s,r)=>s+r.debit,0),c=rows.reduce((s,r)=>s+r.credit,0);
  $("#modalSummary").innerHTML=`<div><span>Movimientos</span><b>${rows.length}</b></div><div><span>Débitos</span><b>${money(d)}</b></div><div><span>Créditos</span><b>${money(c)}</b></div><div><span>Saldo neto</span><b>${money(d-c)}</b></div>`;
  $("#modalTable").innerHTML=tableHTML(rows);
  $("#detailModal").classList.remove("hidden");
}
function tableHTML(rows){
  return `<table class="data-table"><thead><tr><th>Fecha</th><th>Invoice</th><th>Journal</th><th>Broker</th><th>Name</th><th>Débito</th><th>Crédito</th><th>Batch</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.invoice)}</td><td>${esc(r.journal)}</td><td>${esc(r.broker)}</td><td>${esc(r.name)}</td><td class="num">${r.debit?money(r.debit):"—"}</td><td class="num">${r.credit?money(r.credit):"—"}</td><td>${esc(r.batch)}</td></tr>`).join("")}</tbody></table>`;
}
function renderAccountsTable(){
  const groups=groupBy(state.filtered,"account");
  const rows=[...groups.entries()].map(([account,rs])=>{const d=rs.reduce((s,r)=>s+r.debit,0),c=rs.reduce((s,r)=>s+r.credit,0);return {account,count:rs.length,d,c,b:d-c,clients:new Set(rs.map(r=>r.client)).size,brokers:new Set(rs.map(r=>r.broker)).size}}).sort((a,b)=>a.account.localeCompare(b.account));
  $("#accountsTable").innerHTML=`<table class="data-table"><thead><tr><th>Cuenta</th><th>Movimientos</th><th>Clientes</th><th>Brokers</th><th>Débitos</th><th>Créditos</th><th>Saldo neto</th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${esc(r.account)}</b></td><td>${r.count}</td><td>${r.clients}</td><td>${r.brokers}</td><td class="num">${money(r.d)}</td><td class="num">${money(r.c)}</td><td class="num ${Math.abs(r.b)<0.005?"balance-ok":"balance-open"}">${money(r.b)}</td></tr>`).join("")}</tbody></table>`;
}
function renderMovementsTable(){ $("#movementsTable").innerHTML=tableHTML(state.filtered); }

function csvEscape(v){return `"${String(v??"").replace(/"/g,'""')}"`}
function exportRows(rows,name){
  if(!rows.length)return alert("No hay datos para exportar.");
  const cols=["Journal No.","Journal Date","Invoice","Account","Debit","Credit","Description","Name","Client","Broker","Payment Method","Processed At","Batch ID"];
  const lines=[cols.map(csvEscape).join(",")];
  rows.forEach(r=>lines.push([r.journal,r.date,r.invoice,r.account,r.debit||"",r.credit||"",r.description,r.name,r.client,r.broker,r.payment,r.processed,r.batch].map(csvEscape).join(",")));
  const blob=new Blob(["\ufeff"+lines.join("\r\n")],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();URL.revokeObjectURL(a.href);
}
document.querySelectorAll(".nav-item").forEach(btn=>btn.addEventListener("click",()=>{
  document.querySelectorAll(".nav-item").forEach(x=>x.classList.remove("active"));btn.classList.add("active");
  document.querySelectorAll(".view").forEach(v=>v.classList.add("hidden"));$(`#${btn.dataset.view}View`).classList.remove("hidden");
}));
$("#csvInput").addEventListener("change",e=>e.target.files[0]&&loadCSV(e.target.files[0]));
$("#csvInputEmpty").addEventListener("change",e=>e.target.files[0]&&loadCSV(e.target.files[0]));
["globalSearch","accountFilter","clientFilter","brokerFilter"].forEach(id=>$(id).addEventListener("input",applyFilters));
$("#clearFilters").addEventListener("click",()=>{["globalSearch","accountFilter","clientFilter","brokerFilter"].forEach(id=>$(id).value="");applyFilters()});
$("#exportFiltered").addEventListener("click",()=>exportRows(state.filtered,"journal_filtrado.csv"));
$("#exportAll").addEventListener("click",()=>exportRows(state.filtered,"journal_movimientos.csv"));
$("#closeModal").addEventListener("click",()=>$("#detailModal").classList.add("hidden"));
$(".modal-backdrop").addEventListener("click",()=>$("#detailModal").classList.add("hidden"));

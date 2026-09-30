const state={rows:[],filtered:[],headers:[],fileName:""};

const $=s=>document.querySelector(s);
const money=n=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n)||0);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

const aliases={
  journal:["Journal No.","Journal No","Journal Number"],
  date:["Journal Date","Date","Transaction Date"],
  invoice:["Invoice","Invoice No.","Invoice Number"],
  account:["Account","Account Name"],
  debit:["Debit","Debits"],
  credit:["Credit","Credits"],
  description:["Description","Memo"],
  name:["Name","Customer","Vendor"],
  client:["Client","Client Name"],
  broker:["Broker","Broker Name"],
  payment:["Payment Method","Payment"],
  processed:["Processed At","Processed"],
  batch:["Batch ID","Batch"]
};

function parseCSV(text){
  const out=[];let row=[],field="",quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i],n=text[i+1];
    if(c==='"'){if(quoted&&n==='"'){field+='"';i++}else quoted=!quoted}
    else if(c===","&&!quoted){row.push(field);field=""}
    else if((c==="\n"||c==="\r")&&!quoted){
      if(c==="\r"&&n==="\n")i++;
      row.push(field);field="";
      if(row.some(v=>v.trim()!==""))out.push(row);
      row=[];
    }else field+=c;
  }
  if(field!==""||row.length){row.push(field);if(row.some(v=>v.trim()!==""))out.push(row)}
  return out;
}

function numberValue(v){
  if(v===undefined||v===null||String(v).trim()==="")return 0;
  let s=String(v).trim().replace(/\s/g,"").replace(/[$€]/g,"");
  // Handles Colombian/European formats: 2.400,00
  if(s.includes(".")&&s.includes(","))s=s.replace(/\./g,"").replace(",",".");
  else if(s.includes(","))s=s.replace(",",".");
  const n=Number(s.replace(/[^\d.-]/g,""));
  return Number.isFinite(n)?n:0;
}
function field(raw,type){
  const keys=Object.keys(raw);
  const target=aliases[type].find(a=>keys.some(k=>k.trim().toLowerCase()===a.toLowerCase()));
  if(!target)return"";
  const key=keys.find(k=>k.trim().toLowerCase()===target.toLowerCase());
  return raw[key]??"";
}
function normalize(headers,matrix){
  return matrix.map(r=>{
    const raw={};headers.forEach((h,i)=>raw[h]=(r[i]??"").trim());
    return{
      raw,
      journal:String(field(raw,"journal")).trim(),
      date:String(field(raw,"date")).trim(),
      invoice:String(field(raw,"invoice")).trim(),
      account:String(field(raw,"account")).trim()||"Sin cuenta",
      debit:numberValue(field(raw,"debit")),
      credit:numberValue(field(raw,"credit")),
      description:String(field(raw,"description")).trim(),
      name:String(field(raw,"name")).trim(),
      client:String(field(raw,"client")).trim()||String(field(raw,"name")).trim()||"Sin cliente",
      broker:String(field(raw,"broker")).trim()||"Sin broker",
      payment:String(field(raw,"payment")).trim(),
      processed:String(field(raw,"processed")).trim(),
      batch:String(field(raw,"batch")).trim()
    };
  });
}
function unique(a){return[...new Set(a.filter(Boolean))].sort((x,y)=>x.localeCompare(y))}
function populateFilters(){
  const add=(id,values,label)=>{
    $(id).innerHTML=`<option value="">${label}</option>`+unique(values).map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");
  };
  add("#accountFilter",state.rows.map(r=>r.account),"Cuenta");
  add("#clientFilter",state.rows.map(r=>r.client),"Cliente");
  add("#brokerFilter",state.rows.map(r=>r.broker),"Broker");
}
function applyFilters(){
  const q=$("#search").value.trim().toLowerCase(),a=$("#accountFilter").value,c=$("#clientFilter").value,b=$("#brokerFilter").value;
  state.filtered=state.rows.filter(r=>{
    const hay=[r.journal,r.invoice,r.account,r.client,r.broker,r.name,r.description,r.batch].join(" ").toLowerCase();
    return(!q||hay.includes(q))&&(!a||r.account===a)&&(!c||r.client===c)&&(!b||r.broker===b);
  });
  render();
}
function render(){
  const rows=state.filtered,d=rows.reduce((s,r)=>s+r.debit,0),c=rows.reduce((s,r)=>s+r.credit,0);
  $("#metricRows").textContent=rows.length.toLocaleString();
  $("#metricInvoices").textContent=`${new Set(rows.map(r=>r.invoice).filter(Boolean)).size.toLocaleString()} invoices`;
  $("#metricDebit").textContent=money(d);
  $("#metricCredit").textContent=money(c);
  $("#metricDiff").textContent=money(d-c);
  renderAccounts();
  renderAccountTable();
  renderTransactions();
}
function group(rows,key){
  const m=new Map();rows.forEach(r=>{if(!m.has(r[key]))m.set(r[key],[]);m.get(r[key]).push(r)});return m;
}
function renderAccounts(){
  const groups=group(state.filtered,"account");
  $("#accountList").innerHTML=[...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([account,rows])=>{
    const d=rows.reduce((s,r)=>s+r.debit,0),c=rows.reduce((s,r)=>s+r.credit,0);
    const clients=group(rows,"client");
    const clientHtml=[...clients.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([client,cr])=>{
      const cd=cr.reduce((s,r)=>s+r.debit,0),cc=cr.reduce((s,r)=>s+r.credit,0);
      const brokers=unique(cr.map(r=>r.broker)).join(" · ");
      return `<div class="client-line" data-account="${esc(account)}" data-client="${esc(client)}">
        <div><div class="client-name">${esc(client)}</div><div class="client-meta">${esc(brokers||"Sin broker")} · ${cr.length} movimientos</div></div>
        <div class="client-col"><span class="cell-label">Débitos</span><span class="cell-value">${money(cd)}</span></div>
        <div class="client-col"><span class="cell-label">Créditos</span><span class="cell-value">${money(cc)}</span></div>
        <div class="client-col"><span class="cell-label">Movimientos</span><span class="cell-value">${cr.length}</span></div>
        <div class="client-arrow">›</div>
      </div>`;
    }).join("");
    return `<article class="account-row">
      <div class="account-main">
        <div><div class="account-name">${esc(account)}</div><span class="account-sub">${clients.size} clientes · ${rows.length} movimientos</span></div>
        <div class="metric-col"><span class="cell-label">Débitos</span><span class="cell-value">${money(d)}</span></div>
        <div class="metric-col"><span class="cell-label">Créditos</span><span class="cell-value">${money(c)}</span></div>
        <div class="metric-col"><span class="cell-label">Saldo</span><span class="cell-value">${money(d-c)}</span></div>
        <div class="account-arrow">⌄</div>
      </div>
      <div class="account-detail">${clientHtml}</div>
    </article>`;
  }).join("")||`<div class="empty-view"><div class="empty-inner"><h2>Sin resultados</h2><p>Prueba ajustando los filtros.</p></div></div>`;
  document.querySelectorAll(".account-main").forEach(el=>el.addEventListener("click",()=>el.parentElement.classList.toggle("open")));
  document.querySelectorAll(".client-line").forEach(el=>el.addEventListener("click",()=>openDrawer(el.dataset.account,el.dataset.client)));
}
function renderAccountTable(){
  const groups=group(state.filtered,"account");
  const rows=[...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([account,rs])=>{
    const d=rs.reduce((s,r)=>s+r.debit,0),c=rs.reduce((s,r)=>s+r.credit,0);
    return{account,count:rs.length,clients:new Set(rs.map(r=>r.client)).size,brokers:new Set(rs.map(r=>r.broker).filter(Boolean)).size,d,c,b:d-c};
  });
  $("#accountsTable").innerHTML=`<table class="data-table"><thead><tr><th>Cuenta</th><th>Movimientos</th><th>Clientes</th><th>Brokers</th><th>Débitos</th><th>Créditos</th><th>Saldo</th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${esc(r.account)}</b></td><td>${r.count}</td><td>${r.clients}</td><td>${r.brokers}</td><td class="num">${money(r.d)}</td><td class="num">${money(r.c)}</td><td class="num balance">${money(r.b)}</td></tr>`).join("")}</tbody></table>`;
}
function tableHTML(rows){
  return `<table class="data-table"><thead><tr><th>Fecha</th><th>Invoice</th><th>Cuenta</th><th>Cliente</th><th>Broker</th><th>Débito</th><th>Crédito</th><th>Journal</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.invoice)}</td><td>${esc(r.account)}</td><td>${esc(r.client)}</td><td>${esc(r.broker)}</td><td class="num">${money(r.debit)}</td><td class="num">${money(r.credit)}</td><td>${esc(r.journal)}</td></tr>`).join("")}</tbody></table>`;
}
function renderTransactions(){ $("#transactionsTable").innerHTML=tableHTML(state.filtered); }

function openDrawer(account,client){
  const rows=state.filtered.filter(r=>r.account===account&&r.client===client);
  const d=rows.reduce((s,r)=>s+r.debit,0),c=rows.reduce((s,r)=>s+r.credit,0);
  $("#drawerTitle").textContent=client;
  $("#drawerMeta").innerHTML=`<div><span>Cuenta</span><strong>${esc(account)}</strong></div><div><span>Débitos</span><strong>${money(d)}</strong></div><div><span>Créditos</span><strong>${money(c)}</strong></div><div><span>Movimientos</span><strong>${rows.length}</strong></div>`;
  $("#drawerTable").innerHTML=tableHTML(rows);
  $("#drawer").classList.remove("hidden");
}
function csvEscape(v){return`"${String(v??"").replace(/"/g,'""')}"`}
function exportRows(rows,name){
  if(!rows.length)return;
  const cols=["Journal No.","Journal Date","Invoice","Account","Debit","Credit","Description","Name","Client","Broker","Payment Method","Processed At","Batch ID"];
  const lines=[cols.map(csvEscape).join(",")];
  rows.forEach(r=>lines.push([r.journal,r.date,r.invoice,r.account,r.debit||"",r.credit||"",r.description,r.name,r.client,r.broker,r.payment,r.processed,r.batch].map(csvEscape).join(",")));
  const blob=new Blob(["\ufeff"+lines.join("\r\n")],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();URL.revokeObjectURL(a.href);
}
function loadFile(file){
  const reader=new FileReader();
  reader.onload=()=>{
    const matrix=parseCSV(reader.result);
    if(!matrix.length){alert("El archivo no contiene información.");return}
    const headers=matrix.shift().map(v=>v.trim());
    state.headers=headers;state.rows=normalize(headers,matrix);state.filtered=[...state.rows];state.fileName=file.name;
    $("#fileLabel").textContent=file.name;
    $("#emptyView").classList.add("hidden");$("#dataView").classList.remove("hidden");
    populateFilters();applyFilters();
  };
  reader.readAsText(file,"UTF-8");
}

$("#fileInput").addEventListener("change",e=>e.target.files[0]&&loadFile(e.target.files[0]));
$("#emptyFileInput").addEventListener("change",e=>e.target.files[0]&&loadFile(e.target.files[0]));
["search","accountFilter","clientFilter","brokerFilter"].forEach(id=>$( "#"+id).addEventListener("input",applyFilters));
$("#resetFilters").addEventListener("click",()=>{["search","accountFilter","clientFilter","brokerFilter"].forEach(id=>$("#"+id).value="");applyFilters()});
$("#exportButton").addEventListener("click",()=>exportRows(state.filtered,"conciliacion_we_capital_filtrado.csv"));
$("#exportTransactions").addEventListener("click",()=>exportRows(state.filtered,"conciliacion_we_capital_movimientos.csv"));
$("#closeDrawer").addEventListener("click",()=>$("#drawer").classList.add("hidden"));
$(".drawer-backdrop").addEventListener("click",()=>$("#drawer").classList.add("hidden"));

document.querySelectorAll(".nav-link").forEach(btn=>btn.addEventListener("click",()=>{
  document.querySelectorAll(".nav-link").forEach(x=>x.classList.remove("active"));btn.classList.add("active");
  $("#dataView").classList.toggle("hidden",btn.dataset.view!=="overview");
  $("#accountsView").classList.toggle("hidden",btn.dataset.view!=="accounts");
  $("#transactionsView").classList.toggle("hidden",btn.dataset.view!=="transactions");
}));

const state = { rows: [], filtros: {} };
const charts = {};

const CORES = ["#0b4f8a","#1f8a5b","#e0a800","#c0392b","#6c5ce7","#0984e3","#00b894","#e17055","#636e72","#fd79a8"];

Papa.parse("data/base_tratada.csv", {
  download: true, header: true, skipEmptyLines: true,
  complete: (res) => {
    if (res.errors.length) console.warn("Linhas do CSV com problemas:", res.errors);
    state.rows = res.data.map(r => ({
      ...r,
      qtd_sigtap: Number(r.qtd_sigtap)||0,
      tempo_cirurgico_min: toNumber(r.tempo_cirurgico_min),
      ocupacao_sala_min: toNumber(r.ocupacao_sala_min),
      setup_entrada_inicio_min: toNumber(r.setup_entrada_inicio_min),
      pos_cirurgia_min: toNumber(r.pos_cirurgia_min)
    }));
    initFiltros(); renderAll();
  },
  error: (error) => showError("Não foi possível carregar os dados. Abra o painel usando um servidor local.", error)
});

function initFiltros(){
  const uniq = (k) => [...new Set(state.rows.map(r=>r[k]).filter(Boolean))].sort();
  fill("f-mes","mes",uniq("mes"));
  fill("f-sala","sala",uniq("sala"));
  fill("f-turno","turno",uniq("turno"));
  fill("f-tipo","tipo_cirurgia",uniq("tipo_cirurgia"));
  fill("f-porte","porte",uniq("porte"));
  fill("f-onco","oncologica",uniq("oncologica"));
  ["f-mes","f-sala","f-turno","f-tipo","f-porte","f-onco"].forEach(id=>{
    document.getElementById(id).addEventListener("change",()=>{lerFiltros();renderAll();});
  });
  document.getElementById("f-reset").addEventListener("click",()=>{
    ["f-mes","f-sala","f-turno","f-tipo","f-porte","f-onco"].forEach(id=>document.getElementById(id).value="");
    lerFiltros(); renderAll();
  });
  document.querySelectorAll(".tab").forEach(t=>{
    t.addEventListener("click",()=>{
      document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
      document.querySelectorAll(".tab").forEach(x=>x.setAttribute("aria-selected","false"));
      document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));
      t.classList.add("active");
      t.setAttribute("aria-selected","true");
      document.getElementById("page-"+t.dataset.page).classList.add("active");
    });
  });
  lerFiltros();
}
function fill(id,field,vals){
  const sel=document.getElementById(id);
  vals.forEach(v=>{const o=document.createElement("option");o.value=v;o.textContent=v;sel.appendChild(o);});
}
function lerFiltros(){
  state.filtros = {
    mes:document.getElementById("f-mes").value,
    sala:document.getElementById("f-sala").value,
    turno:document.getElementById("f-turno").value,
    tipo_cirurgia:document.getElementById("f-tipo").value,
    porte:document.getElementById("f-porte").value,
    oncologica:document.getElementById("f-onco").value
  };
}
function filtered(){
  return state.rows.filter(r=>Object.entries(state.filtros).every(([k,v])=>!v || r[k]===v));
}
function renderAll(){ renderExec(); renderProd(); renderSusp(); renderTempos(); }

// ---------- EXECUTIVA ----------
function renderExec(){
  const d=filtered(); const real=d.filter(r=>r.status==="Realizada");
  const atos=new Set(real.map(r=>r.id_evento)).size;
  const procExec=real.reduce((s,r)=>s+r.qtd_sigtap,0);
  const totalEventos=new Set(d.map(r=>r.id_evento).filter(Boolean)).size;
  const susp=new Set(d.filter(r=>r.status==="Suspensa").map(r=>r.id_evento).filter(Boolean)).size;
  const taxaSusp=totalEventos? (susp/totalEventos*100):0;
  const tempoMed=media(real.map(r=>r.tempo_cirurgico_min));
  const ocupMed=media(real.map(r=>r.ocupacao_sala_min));
  const onco=real.filter(r=>r.oncologica==="Sim").length;
  const pos22=real.filter(r=>r.iniciou_apos_22h==="Sim").length;
  const elet=real.filter(r=>r.tipo_cirurgia==="Eletiva").length;
  const emer=real.filter(r=>r.tipo_cirurgia==="Emergência").length;

  document.getElementById("kpis-exec").innerHTML = [
    kpi("Procedimentos realizados", real.length),
    kpi("Atos cirúrgicos", atos),
    kpi("Procedimentos executados", procExec, "soma qtd. SIGTAP"),
    kpi("Taxa de suspensão", taxaSusp.toFixed(1)+"%", susp+" suspensas"),
    kpi("Tempo cirúrgico médio", tempoMed?tempoMed.toFixed(0)+" min":"—"),
    kpi("Ocupação média de sala", ocupMed?ocupMed.toFixed(0)+" min":"—"),
    kpi("Oncológicas", onco),
    kpi("Iniciadas após 22h", pos22)
  ].join("");

  chart("ch-mes","bar", byMonth(real), "Procedimentos");
  chart("ch-tipo","doughnut", {labels:["Eletiva","Emergência"],datasets:[{data:[elet,emer],backgroundColor:[CORES[0],CORES[2]]}]});
  chart("ch-porte","bar", countBy(real,"porte"), "Cirurgias", true);
  chart("ch-22h","bar", countBy(real.filter(r=>r.iniciou_apos_22h==="Sim"),"mes"), "Após 22h");
}

// ---------- PRODUCAO ----------
function renderProd(){
  const d=filtered().filter(r=>r.status==="Realizada");
  chart("ch-dia","bar", countBy(d,"dia_semana"), "Procedimentos");
  chart("ch-turno","doughnut", {labels:Object.keys(countBy(d,"turno")),datasets:[{data:Object.values(countBy(d,"turno")),backgroundColor:CORES}]});
  chart("ch-top-proc","bar", topN(d,"procedimento_principal",10), "Procedimentos", true);
  chart("ch-top-cid","bar", topN(d,"grupo_cid",10), "Procedimentos", true);
  chart("ch-sala","bar", countBy(d,"sala"), "Procedimentos");
  chart("ch-anest","bar", countBy(d,"tipo_anestesia"), "Procedimentos", true);
}

// ---------- SUSPENSAS ----------
function renderSusp(){
  const d=filtered(); const s=d.filter(r=>r.status==="Suspensa");
  const totalEventos=new Set(d.map(r=>r.id_evento).filter(Boolean)).size;
  const suspEventos=new Set(s.map(r=>r.id_evento).filter(Boolean)).size;
  const taxa=totalEventos? (suspEventos/totalEventos*100):0;
  document.getElementById("kpis-susp").innerHTML=[
    kpi("Total suspensas", suspEventos),
    kpi("Taxa de suspensão", taxa.toFixed(1)+"%"),
    kpi("Mês com mais suspensões", topKey(s,"mes") || "—"),
    kpi("Principal motivo", topKey(s,"motivo_suspensao_padronizado") || "—")
  ].join("");
  const motivos=countBy(s,"motivo_suspensao_padronizado");
  const sorted=Object.entries(motivos).sort((a,b)=>b[1]-a[1]);
  const total=sorted.reduce((x,y)=>x+y[1],0);
  let acc=0; const perc=sorted.map(([,v])=>{acc+=v;return +(acc/total*100).toFixed(1);});
  chart("ch-pareto","bar", Object.fromEntries(sorted), "Suspensas", false, perc);
  chart("ch-susp-mes","bar", countBy(s,"mes"), "Suspensas");
  chart("ch-susp-sala","bar", countBy(s,"sala"), "Suspensas");
  chart("ch-susp-tipo","bar", countBy(s,"tipo_cirurgia"), "Suspensas");
}

// ---------- TEMPOS E QUALIDADE ----------
function renderTempos(){
  const d=filtered().filter(r=>r.status==="Realizada" && r.tempo_invalido!=="Sim");
  const tempo=media(d.map(r=>r.tempo_cirurgico_min));
  const ocup=media(d.map(r=>r.ocupacao_sala_min));
  const setup=media(d.map(r=>r.setup_entrada_inicio_min));
  const pos=media(d.map(r=>r.pos_cirurgia_min));
  document.getElementById("kpis-tempos").innerHTML=[
    kpi("Tempo cirúrgico médio", fmtMin(tempo)),
    kpi("Ocupação média de sala", fmtMin(ocup)),
    kpi("Setup médio", fmtMin(setup)),
    kpi("Pós-cirúrgico médio", fmtMin(pos))
  ].join("");
  chart("ch-tempo-mes","bar", avgBy(d,"mes","tempo_cirurgico_min"), "Minutos");
  chart("ch-tempo-porte","bar", avgBy(d,"porte","tempo_cirurgico_min"), "Minutos", true);
  chart("ch-setup","bar", avgBy(d,"mes","setup_entrada_inicio_min"), "Minutos");
  chart("ch-pos","bar", avgBy(d,"mes","pos_cirurgia_min"), "Minutos");
  chart("ch-hist","bar", histogram(d.map(r=>r.tempo_cirurgico_min)), "Cirurgias");
}

// ---------- HELPERS ----------
function toNumber(value){
  if(value===null || value===undefined || String(value).trim()==="") return null;
  const n=Number(String(value).replace(",","."));
  return Number.isFinite(n)?n:null;
}

function media(values){
  const valid=values.filter(Number.isFinite);
  return valid.length?valid.reduce((sum,n)=>sum+n,0)/valid.length:null;
}

function fmtMin(value){ return Number.isFinite(value)?value.toFixed(0)+" min":"—"; }

function countBy(rows,key){
  return rows.reduce((out,row)=>{
    const label=row[key] || "Não informado";
    out[label]=(out[label]||0)+1;
    return out;
  },{});
}

function byMonth(rows){ return countBy(rows,"mes"); }

function topN(rows,key,n){
  return Object.fromEntries(Object.entries(countBy(rows,key)).sort((a,b)=>b[1]-a[1]).slice(0,n));
}

function topKey(rows,key){
  return Object.entries(countBy(rows,key)).sort((a,b)=>b[1]-a[1])[0]?.[0] || "";
}

function avgBy(rows,groupKey,valueKey){
  const groups={};
  rows.forEach(row=>{
    if(Number.isFinite(row[valueKey])) (groups[row[groupKey]||"Não informado"] ||= []).push(row[valueKey]);
  });
  return Object.fromEntries(Object.entries(groups).map(([key,values])=>[key,+media(values).toFixed(1)]));
}

function histogram(values){
  const bins=[[0,30],[30,60],[60,90],[90,120],[120,180],[180,240],[240,Infinity]];
  return Object.fromEntries(bins.map(([start,end])=>[
    end===Infinity?start+"+":start+"–"+(end-1),
    values.filter(v=>Number.isFinite(v) && v>=start && v<end).length
  ]));
}

function kpi(label,value,sub=""){
  return `<div class="kpi"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div>${sub?`<div class="sub">${escapeHtml(sub)}</div>`:""}</div>`;
}

function escapeHtml(value){
  const el=document.createElement("span");
  el.textContent=String(value);
  return el.innerHTML;
}

function chart(id,type,data,label,horizontal=false,pareto=[]){
  if(charts[id]) charts[id].destroy();
  const labels=data.labels || Object.keys(data);
  const datasets=data.datasets || [{label,data:Object.values(data),backgroundColor:CORES[0]}];
  if(type==="doughnut" && !data.datasets){ datasets[0].backgroundColor=labels.map((_,i)=>CORES[i%CORES.length]); }
  if(pareto.length){
    datasets.push({type:"line",label:"% acumulado",data:pareto,borderColor:CORES[3],backgroundColor:CORES[3],yAxisID:"y1"});
  }
  const options={responsive:true,maintainAspectRatio:false,indexAxis:horizontal?"y":"x",plugins:{legend:{display:type==="doughnut" || pareto.length>0}}};
  if(type!=="doughnut"){
    options.scales={x:{beginAtZero:true},y:{beginAtZero:true}};
    if(pareto.length) options.scales.y1={beginAtZero:true,max:100,position:"right",grid:{drawOnChartArea:false},ticks:{callback:v=>v+"%"}};
  }
  charts[id]=new Chart(document.getElementById(id),{type,data:{labels,datasets},options});
}

function showError(message,error){
  console.error(message,error);
  const alert=document.createElement("div");
  alert.className="alert alert-danger m-4";
  alert.setAttribute("role","alert");
  alert.textContent=message;
  document.querySelector("main").prepend(alert);
}

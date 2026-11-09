const state = { rows: [], filtros: {} };
const charts = {};

const CORES = ["#0b4f8a","#1f8a5b","#e0a800","#c0392b","#6c5ce7","#0984e3","#00b894","#e17055","#636e72","#fd79a8"];

Papa.parse("data/base_tratada.csv", {
  download: true, header: true, skipEmptyLines: true,
  complete: (res) => {
    state.rows = res.data.map(r => ({
      ...r,
      qtd_sigtap: Number(r.qtd_sigtap)||0,
      tempo_cirurgico_min: Number(r.tempo_cirurgico_min)||null,
      ocupacao_sala_min: Number(r.ocupacao_sala_min)||null,
      setup_entrada_inicio_min: Number(r.setup_entrada_inicio_min)||null,
      pos_cirurgia_min: Number(r.pos_cirurgia_min)||null
    }));
    initFiltros(); renderAll();
  }
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
      document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));
      t.classList.add("active");
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
  const susp=d.filter(r=>r.status==="Suspensa").length;
  const taxaSusp=d.length? (susp/d.length*100):0;
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
  const taxa=d.length? (s.length/d.length*100):0;
  document.getElementById("kpis-susp").innerHTML=[
    kpi("Total suspensas", s.length),
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
  chart("ch-susp-sala","bar", countBy(s
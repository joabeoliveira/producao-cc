import pandas as pd, re, unicodedata
from pathlib import Path
from datetime import datetime, time

SRC = "Producao Cirurgia geral Ago-Out - base.csv"
OUT = Path("painel-cirurgia/data/base_tratada.csv")

df = pd.read_csv(SRC, encoding="utf-8-sig")

# ---------- helpers ----------
def norm(s):
    if pd.isna(s): return ""
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii","ignore").decode()
    return re.sub(r"\s+"," ",s).strip().upper()

def to_time(s):
    if pd.isna(s) or str(s).strip()=="" : return None
    s=str(s).strip()
    for fmt in ("%H:%M","%H:%M:%S"):
        try: return datetime.strptime(s,fmt).time()
        except: pass
    return None

def minutes_between(t1,t2):
    if t1 is None or t2 is None: return None
    d1=datetime.combine(datetime.today(),t1); d2=datetime.combine(datetime.today(),t2)
    if d2<d1: d2=pd.Timedelta(days=1)+d2  # atravessa meia-noite
    return int((d2-d1).total_seconds()//60)

def codigos_anonimos(serie, prefixo):
    nomes = sorted({norm(nome) for nome in serie if norm(nome)})
    mapa = {nome: f"{prefixo}-{i:03d}" for i, nome in enumerate(nomes, 1)}
    return serie.apply(lambda nome: mapa.get(norm(nome), ""))

# ---------- motivo padronizado ----------
def pad_motivo(m, det):
    t = norm(m)+" "+norm(det)
    regras = [
        ("Paciente não internou", ["NAO INTERNOU","NÃO INTERNOU"]),
        ("Condições clínicas", ["CONDICOES CLINICAS","CONDIÇÕES CLÍNICAS","CLINICAS","RISCO","ASA","DESCOMPENS","HIPERTENS","DIABET","CARDIAC","ELETROCARD","FA DE ALTA","ENFISEMA","AVC","CROHN","ANEMIA"]),
        ("Erro de programação", ["ERRO","JA OPEROU","JÁ OPEROU","MUDANCA EM CONDUTA","ALTERACAO DE CONDUTA","EQUIPE","FALTA DE ANESTESISTA","FALTA DE CIRURGIAO"]),
        ("Adiantado da hora", ["ADIANTADO"]),
        ("Falta de CTI", ["FALTA DE CTI","SEM VAGA","VAGA DE UNIDADE"]),
        ("Substituída por emergência", ["SUBSTITUIDA","EMERGENCIA"]),
        ("Preparo inadequado", ["PREPARO","JEJUM","USG","EXAME","MONJAURO","MEDICAC"]),
        ("Desistência", ["DESIST","EVADIU"]),
    ]
    for cat,keys in regras:
        if any(k in t for k in keys): return cat
    return "Outros" if norm(m) or norm(det) else ""

# ---------- limpeza ----------
df["data_cirurgia"] = pd.to_datetime(df["Data da cirurgia"], dayfirst=True, errors="coerce")
df["mes"] = df["data_cirurgia"].dt.strftime("%Y-%m")
df["dia_semana"] = df["data_cirurgia"].dt.day_name().str.lower().replace({
 "monday":"segunda","tuesday":"terça","wednesday":"quarta","thursday":"quinta",
 "friday":"sexta","saturday":"sábado","sunday":"domingo"})

df["status"] = df["Status da cirurgia"].str.strip()
df["tipo_cirurgia"] = df["Tipo de cirurgia"].str.strip()
df["porte"] = df["Porte"].fillna("").str.strip()
df["oncologica"] = df["Cirurgia Oncológica"].apply(lambda valor: "Sim" if norm(valor)=="SIM" else "Não")
df["sala"] = df["Sala"].astype(str).str.strip()
df["procedencia"] = df["Procedência"].fillna("").astype(str).str.strip()
df["destino"] = df["Destino"].fillna("").astype(str).str.strip()
df["tipo_anestesia"] = df["Tipo de Anestesia (quando houver)"].fillna("").astype(str).str.strip()

# procedimento principal: se vazio, usa o secundário
df["proc_princ"] = df["Procedimento principal realizado"].fillna("").astype(str).str.strip()
df["proc_sec"]   = df["Procedimento secundário realizado"].fillna("").astype(str).str.strip()
mask_vazio = (df["proc_princ"]=="")
df.loc[mask_vazio,"proc_princ"] = df.loc[mask_vazio,"proc_sec"]
df["procedimento_principal"] = df["proc_princ"].apply(lambda x: re.sub(r"^\d+\s*-\s*","",x).strip())
df["procedimento_secundario"] = df["proc_sec"].apply(lambda x: re.sub(r"^\d+\s*-\s*","",x).strip())
df["grupo_sigtap"] = df["proc_princ"].str.extract(r"^(\d{4}\.\d{2}\.\d{2})")
df["cid"] = df["CID 10"].fillna("").astype(str).str.strip()
df["grupo_cid"] = df["Descrição CID 10"].fillna("").astype(str).str.strip()
cid_valido = df["cid"].str.match(r"^[A-Z][0-9]{2}(?:\.[0-9A-Z]{1,4})?$", case=False)
df.loc[~cid_valido, ["cid", "grupo_cid"]] = ""
df["qtd_sigtap"] = pd.to_numeric(df["Quantidade de procedimentos dentro do mesmo código SIGTAP"], errors="coerce")

# tempos
for c,src in [("t_entrada_cc","Entrada C.C"),("t_inicio_anest","Iní. Anest"),
              ("t_inicio_cir","Início cirurgia"),("t_fim_cir","Término cirurgia"),
              ("t_fim_anest","Térm. Anest"),("t_saida_so","Saída S.O")]:
    df[c] = df[src].apply(to_time)

df["tempo_cirurgico_min"] = [minutes_between(a,b) for a,b in zip(df["t_inicio_cir"],df["t_fim_cir"])]
df["ocupacao_sala_min"]   = [minutes_between(a,b) for a,b in zip(df["t_entrada_cc"],df["t_saida_so"])]
df["setup_entrada_inicio_min"] = [minutes_between(a,b) for a,b in zip(df["t_entrada_cc"],df["t_inicio_cir"])]
df["pos_cirurgia_min"]    = [minutes_between(a,b) for a,b in zip(df["t_fim_cir"],df["t_saida_so"])]

df["iniciou_apos_22h"] = df["t_inicio_cir"].apply(lambda t: "Sim" if t and (t.hour>=22 or t.hour<6) else "Não")
df["tempo_invalido"] = df["tempo_cirurgico_min"].apply(
    lambda valor: "Sim" if pd.isna(valor) or valor <= 0 or valor > 24 * 60 else "Não"
)

# turno
df["turno"] = df["t_inicio_cir"].apply(
    lambda t: "" if t is None else ("Noturno" if t.hour>=19 or t.hour<7 else "Diurno")
)

# motivo suspensão
df["motivo_suspensao_padronizado"] = [
    pad_motivo(m,d) if s=="Suspensa" else ""
    for m,d,s in zip(df["Motivo de Suspensão"], df["Detalhamento"], df["status"])
]

# anonimização
df["cirurgiao_anon"] = codigos_anonimos(df["Cirurgião responsável"], "CIR")
df["anestesista_anon"] = codigos_anonimos(df["Anestesista (quando houver)"], "ANE")

# deduplicação
chave_evento = (
    df["CNS do paciente"].fillna("").astype(str) + "|" +
    df["data_cirurgia"].astype(str) + "|" +
    df["sala"].astype(str) + "|" +
    df["t_inicio_cir"].astype(str) + "|" +
    df["procedimento_principal"]
)
df["id_evento"] = pd.factorize(chave_evento, sort=True)[0] + 1
df["id_evento"] = df["id_evento"].map(lambda numero: f"EVT-{numero:06d}")
df = df.drop_duplicates(subset=["id_evento","procedimento_secundario"], keep="first")

cols = ["id_evento","mes","data_cirurgia","dia_semana","turno","status","tipo_cirurgia","porte",
        "oncologica","sala","procedencia","destino","tipo_anestesia","procedimento_principal",
        "procedimento_secundario","grupo_sigtap","cid","grupo_cid","qtd_sigtap",
        "t_entrada_cc","t_inicio_anest","t_inicio_cir","t_fim_cir","t_fim_anest","t_saida_so",
        "tempo_cirurgico_min","ocupacao_sala_min","setup_entrada_inicio_min","pos_cirurgia_min",
        "iniciou_apos_22h","tempo_invalido","motivo_suspensao_padronizado",
        "cirurgiao_anon","anestesista_anon"]

OUT.parent.mkdir(parents=True, exist_ok=True)
df[cols].to_csv(OUT, index=False, encoding="utf-8-sig", date_format="%Y-%m-%d")
print("OK:", OUT, len(df), "linhas")

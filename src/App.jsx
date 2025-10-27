// --- Imports principais ---
import React, { useEffect, useMemo, useState } from "react";

// --- Conexão com Supabase ---
import { supabase } from "./supabaseClient";
import {
  listLicencas,
  insertLicenca,
  updateLicenca,
  deleteLicenca,
  subscribeLicencas,
} from "./db";

// --- Componentes e bibliotecas auxiliares ---
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as ReTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import { motion } from "framer-motion";
import {
  Download,
  Plus,
  Upload,
  Trash2,
  Edit3,
  Search,
  AlertTriangle,
  Calendar,
  Info,
  ChevronLeft,
  ChevronRight,
  FileText,
  FileUp,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Importar PDF (beta) — lazy + seguro + correto
/* ---------- UI ---------- */
const Button = ({ className = "", children, ...props }) => (
  <button className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border border-brand-100 hover:bg-brand-100/60 transition text-sm ${className}`} {...props}>{children}</button>
);
const Primary = ({ className = "", children, ...props }) => (
  <button className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-brand text-white hover:bg-brand-800 transition text-sm ${className}`} {...props}>{children}</button>
);
const Input = ({ className = "", ...props }) => (
  <input className={`w-full rounded-xl border border-brand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/10 ${className}`} {...props} />
);
const Select = ({ className = "", children, ...props }) => (
  <select className={`w-full rounded-xl border border-brand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/10 ${className}`} {...props}>{children}</select>
);
const Label = ({ className = "", children }) => (
  <label className={`text-xs font-semibold text-brand-800 ${className}`}>{children}</label>
);
const Badge = ({ className = "", children }) => (
  <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium ${className}`}>{children}</span>
);

/* ---------- Helpers ---------- */
const SIDEBAR_W = 320;
const todayISO = () => new Date().toISOString().slice(0, 10);
const toISO = (d) => { try { return new Date(d).toISOString().slice(0, 10); } catch { return d; } };
const diffDays = (dateISO) => {
  const a = new Date(toISO(dateISO)); const b = new Date(todayISO());
  return Math.round((a.setHours(0,0,0,0) - b.setHours(0,0,0,0)) / 86400000);
};
const formatBR = (iso) => { if (!iso) return ""; const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };

const STATUS = { VENCIDO:"Vencido", V30:"A vencer (≤30d)", V60:"A vencer (31–60d)", V90:"A vencer (61–90d)", OK:"Ok (>90d)" };
const SITUACAO = { NORMAL:"Normal", RENOVACAO:"Em renovação" };
const getStatus = (dueISO) => {
  const d = diffDays(dueISO);
  if (isNaN(d)) return "";
  if (d < 0) return STATUS.VENCIDO;
  if (d <= 30) return STATUS.V30;
  if (d <= 60) return STATUS.V60;
  if (d <= 90) return STATUS.V90;
  return STATUS.OK;
};
const statusColor = (s) =>
  s === STATUS.VENCIDO ? "bg-red-100 text-red-800" :
  s === STATUS.V30 ? "bg-amber-100 text-amber-900" :
  s === STATUS.V60 ? "bg-brand-200 text-brand-900" :
  s === STATUS.V90 ? "bg-brand-100 text-brand-900" :
  "bg-brand-100 text-brand-800";
const situacaoColor = (s) => s === SITUACAO.RENOVACAO ? "bg-brand-200 text-brand-900" : "bg-brand-100 text-brand-800";

const UF_LIST = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const ORGAOS_SUG = ["Prefeitura Municipal","Vigilância Sanitária","Corpo de Bombeiros (AVCB)","Secretaria do Meio Ambiente","IAP/IMA/SEMA (Ambiental)","ANVISA","SEFAZ (Estadual)"];

/* ---------- Defaults ---------- */
const DEFAULT_FORM = {
  tipo:"Alvará de Funcionamento",
  orgao:"", numero:"", empresa:"", municipio:"", uf:"",
  emissao:todayISO(), vencimento:"",
  responsavel:"", situacao:SITUACAO.NORMAL,
  // novos:
  protocolo:"", observacao:"", renovacao_prazo:""
};

const seed = [
  { id: crypto.randomUUID(), tipo:"Alvará de Funcionamento", orgao:"Prefeitura Municipal", numero:"AF-2025-001", empresa:"Loja Centro", municipio:"Cascavel", uf:"PR", emissao:"2025-01-15", vencimento:"2026-01-15", responsavel:"Mariana", situacao:SITUACAO.NORMAL },
  { id: crypto.randomUUID(), tipo:"AVCB (Bombeiros)", orgao:"Corpo de Bombeiros (AVCB)", numero:"AVCB-98765", empresa:"Cozinha Industrial", municipio:"Cascavel", uf:"PR", emissao:"2024-08-01", vencimento:"2025-12-10", responsavel:"Mateus", situacao:SITUACAO.RENOVACAO },
  { id: crypto.randomUUID(), tipo:"Licença Sanitária", orgao:"Vigilância Sanitária", numero:"LS-3321", empresa:"Monka Fit Food", municipio:"Cascavel", uf:"PR", emissao:"2024-11-10", vencimento:"2025-11-10", responsavel:"Luísa", situacao:SITUACAO.NORMAL }
];

/* ---------- CSV helpers ---------- */
function csvEscape(v){ if(v==null) return ""; const s=String(v); return /[",\n;]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; }
function toCSV(list){
  const H=["id","tipo","orgao","numero","empresa","municipio","uf","emissao","vencimento","responsavel","situacao"];
  return H.join(";")+"\n"+list.map(it=>H.map(k=>csvEscape(it[k]??"")).join(";")).join("\n");
}
function csvTemplate(){
  const H=["id","tipo","orgao","numero","empresa","municipio","uf","emissao","vencimento","responsavel","situacao"];
  const ex=["","Alvará de Funcionamento","Prefeitura Municipal","12345","Loja Centro","Cascavel","PR","2025-01-15","2026-01-15","Maria","Normal"];
  return H.join(";")+"\n"+ex.join(";")+"\n";
}
function fromCSV(text){
  const L = text.split(/\r?\n/).filter(Boolean); if(!L.length) return [];
  const H = L[0].split(";"); const idx = Object.fromEntries(H.map((h,i)=>[h.trim(),i]));
  return L.slice(1).map(line=>{
    const parts = line.match(/([^;"]+|\"([^\"]|\"\")*\")(?=;|$)/g)?.map(s=>{
      if(s.startsWith('"')&&s.endsWith('"')) return s.slice(1,-1).replace(/""/g,'"'); return s;
    }) || line.split(";");
    return {
      id: parts[idx.id] || crypto.randomUUID(),
      tipo: parts[idx.tipo] || "",
      orgao: parts[idx.orgao] || "",
      numero: parts[idx.numero] || "",
      empresa: parts[idx.empresa] || "",
      municipio: parts[idx.municipio] || "",
      uf: parts[idx.uf] || "",
      emissao: parts[idx.emissao] || "",
      vencimento: parts[idx.vencimento] || "",
      responsavel: parts[idx.responsavel] || "",
      situacao: parts[idx.situacao] || "Normal"
    };
  });
}
function download(filename, content, mime="text/plain"){
  const blob = new Blob([content], {type: mime+";charset=utf-8"});
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = filename; a.click(); setTimeout(()=>URL.revokeObjectURL(url), 500);
}
function icsForItem(item){
  const start=item.vencimento?.replace(/-/g,"")+"T090000Z";
  const end=item.vencimento?.replace(/-/g,"")+"T100000Z";
  const uid=item.id+"@eb-control";
  const summary=`${item.tipo} — ${item.empresa}`;
  const desc=`Órgão: ${item.orgao}\nNúmero: ${item.numero}\nResponsável: ${item.responsavel}\nSituação: ${item.situacao}`;
  return ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//EbControl//PT-BR//","BEGIN:VEVENT",
    `UID:${uid}`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').split('.')[0]}Z`,
    `DTSTART:${start}`,`DTEND:${end}`,`SUMMARY:${summary}`,`DESCRIPTION:${desc}`,
    "END:VEVENT","END:VCALENDAR"].join("\n");
}

/* ---------- Modal ---------- */
// ✅ Deixe o Modal assim (sem export)
function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null; // 👈 só renderiza quando open === true
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-soft border border-brand-100 w-[min(980px,90vw)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-lg font-medium text-brand-800 mb-2">{title}</div>
        <div>{children}</div>
        <div className="mt-4 flex justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}

// ⚠️ Agora apenas UMA função App exportada no arquivo
export default function App() {

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [editingId, setEditingId] = useState(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tipoFilter, setTipoFilter] = useState("");
  const [empresaFilter, setEmpresaFilter] = useState("");

  const enriched = useMemo(()=>items.map(it=>({...it, status:getStatus(it.vencimento), dias:diffDays(it.vencimento)})), [items]);
  const empresas = useMemo(()=>Array.from(new Set(items.map(i=>i.empresa).filter(Boolean))).sort(), [items]);
  const tipos = ["Alvará de Funcionamento","AVCB (Bombeiros)","Licença Sanitária","Licença Ambiental","Outro"];

  const filtered = useMemo(()=>enriched.filter(it=>{
    const q=query.trim().toLowerCase();
    const matchQ=!q || [it.tipo,it.orgao,it.numero,it.empresa,it.municipio,it.uf,it.responsavel].some(v=>(v||"").toLowerCase().includes(q));
    const matchS=!statusFilter || it.status===statusFilter;
    const matchT=!tipoFilter || it.tipo===tipoFilter;
    const matchE=!empresaFilter || it.empresa===empresaFilter;
    return matchQ&&matchS&&matchT&&matchE;
  }),[enriched,query,statusFilter,tipoFilter,empresaFilter]);

  useEffect(() => {
    let mounted = true;

    // 1) carga inicial
    (async () => {
      try {
        const rows = await listLicencas();
        if (mounted) setItems(rows);
      } catch (err) {
        console.error("Falha ao listar licenças:", err.message);
        alert("Não foi possível carregar agora.");
      }
    })();

    // 2) inscrição realtime
    const unsubscribe = subscribeLicencas(
      // upsert (INSERT/UPDATE)
      (novo) => {
        setItems((prev) => {
          const i = prev.findIndex((r) => r.id === novo.id);
          if (i >= 0) {
            const clone = [...prev];
            clone[i] = novo;
            return clone;
          }
          return [novo, ...prev]; // inserts entram no topo
        });
      },
      // delete
      (old) => {
        setItems((prev) => prev.filter((r) => r.id !== old.id));
      }
    );

    // cleanup
    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  // Painel
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const sidebarList = useMemo(()=>{
    const arr=[...enriched].filter(it=>it.vencimento).sort((a,b)=>(a.dias??1e9)-(b.dias??1e9));
    return arr.slice(0,8);
  },[enriched]);

  const countsByStatus = useMemo(()=>{
    const m = { [STATUS.VENCIDO]:0,[STATUS.V30]:0,[STATUS.V60]:0,[STATUS.V90]:0,[STATUS.OK]:0 };
    enriched.forEach(it=>{ if(m[it.status]!=null) m[it.status]++; });
    return Object.entries(m).map(([name,value])=>({name,value}));
  },[enriched]);

  const barData = useMemo(()=>{
    const now=new Date(), arr=[];
    for(let i=0;i<12;i++){
      const d=new Date(now.getFullYear(), now.getMonth()+i, 1);
      const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const label=d.toLocaleDateString("pt-BR",{month:"short",year:"2-digit"});
      const count=enriched.filter(it=>it.vencimento?.slice(0,7)===key).length;
      arr.push({ mes:label, Vencimentos:count });
    }
    return arr;
  },[enriched]);

  // Import CSV
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState([]);
  const [selectedRows, setSelectedRows] = useState({});

  // PDF Sugerido
  const [pdfSuggestOpen, setPdfSuggestOpen] = useState(false);
  const [pdfSuggest, setPdfSuggest] = useState(DEFAULT_FORM);

    function resetForm() {
    setForm({ ...DEFAULT_FORM, emissao: todayISO(), vencimento: "" });
    setEditingId(null);
  }

  async function addOrUpdate(e) {
    e.preventDefault();

    // Monte o payload conforme seus campos do formulário
    const payload = {
      tipo: form.tipo,
      orgao: form.orgao,
      numero: form.numero || "",
      empresa: form.empresa,
      municipio: form.municipio,
      uf: form.uf,
      emissao: form.emissao,
      vencimento: form.vencimento,
      responsavel: form.responsavel,
      situacao: form.situacao,
      // novos:
      protocolo: form.protocolo || null,
      observacao: form.observacao || null,
      renovacao_prazo: form.renovacao_prazo || null,
      };

    try {
      if (editingId) {
        await updateLicenca(editingId, payload);
      } else {
        await insertLicenca(payload);
      }
      // NÃO precisa mexer em setItems aqui — o realtime atualiza pra todos
      resetForm();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("Erro ao salvar:", err.message);
      alert("Não foi possível salvar. Tente novamente.");
    }
  }

  function handleEdit(item) {
    setEditingId(item.id);
    setForm({ ...item }); // garanta que os nomes batem com os campos do form
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
    async function handleDelete(id) {
    if (!confirm("Remover este registro?")) return;
    try {
      await deleteLicenca(id);
      // Realtime remove da lista (não precisa mexer no estado)
    } catch (err) {
      console.error("Erro ao excluir:", err.message);
      alert("Não foi possível excluir agora.");
    }
  }
  function handleExportCSV(){ download("eb-control.csv", toCSV(items), "text/csv"); }
  function handleDownloadTemplate(){ download("modelo-eb-control.csv", csvTemplate(), "text/csv"); }

  async function handleImportCSV(e){
  const file = e.target.files?.[0]; if (!file) return;
  const text = await file.text();
  const parsed = fromCSV(text);        // sua função que transforma texto em objetos
  if (!parsed.length){ alert("CSV vazio ou inválido."); return; }
  setPreviewRows(parsed.map(r => ({ ...r, _tmpId: crypto.randomUUID() })));
  setSelectedRows(Object.fromEntries(parsed.map(r => [r.id || r._tmpId, true])));
  setPreviewOpen(true);                 // <<< abre modal
  e.target.value = "";
  }
  async function confirmImport() {
  const toAdd = previewRows.filter(r => selectedRows[r.id || r._tmpId]);
  if (!toAdd.length) { setPreviewOpen(false); return; }

  try {
    await Promise.all(
      toAdd.map(r =>
        insertLicenca({
          tipo: r.tipo,
          orgao: r.orgao,
          numero: r.numero || "",
          empresa: r.empresa,
          municipio: r.municipio,
          uf: r.uf,
          emissao: toISO(r.emissao),
          vencimento: toISO(r.vencimento),
          responsavel: r.responsavel,
          situacao: r.situacao || SITUACAO.NORMAL,
        })
      )
    );
    // Não precisa dar setItems: o realtime cuida
    setPreviewOpen(false);
    setPreviewRows([]);
    setSelectedRows({});
  } catch (err) {
    console.error("Erro ao importar CSV:", err);
    alert("Falha ao importar CSV.");
  }
}
  // Relatório PDF (linhas filtradas)
  function exportPDF(){
    const doc = new jsPDF({ orientation:"landscape" });
    doc.setFont("helvetica","bold"); doc.setFontSize(14);
    doc.text("Eb Control — Relatório de Licenças/Alvarás", 14, 14);
    doc.setFont("helvetica","normal"); doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, 20);
    const rows = filtered.map(it=>[
      it.status, it.tipo, it.orgao, it.numero, it.empresa, `${it.municipio}/${it.uf}`,
      formatBR(it.emissao), formatBR(it.vencimento), it.dias, it.responsavel, it.situacao
    ]);
    autoTable(doc, {
      startY:24,
      head:[["Status","Tipo","Órgão","Número","Empresa","Município/UF","Emissão","Vencimento","Dias","Responsável","Situação"]],
      body:rows,
      styles:{ fontSize:9, cellPadding:2 },
      headStyles:{ fillColor:[10,61,98] },
      theme:"striped"
    });
    doc.save("eb-control-relatorio.pdf");
  }

  // Importar PDF (beta)
  async function handleImportPDF(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const pdfjs = await import('pdfjs-dist/build/pdf.mjs');

    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();

    const buf = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: buf }).promise;

    let text = '';
    for (let p = 1; p <= Math.min(pdf.numPages, 5); p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      text += content.items.map(it => it.str).join(' ') + '\n';
    }

    const find = (rx) => (text.match(rx)?.[1] || '').trim();
    const date = (rx) => {
      const v = find(rx);
      if (!v) return '';
      const m = v.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
      if (m) return `${m[3]}-${m[2]}-${m[1]}`;
      const m2 = v.match(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);
      if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
      return '';
    };

    const sugestao = {
      tipo: /AVCB|Bombeir/i.test(text) ? 'AVCB (Bombeiros)' :
            (/Sanit[áa]ria|Vigil[âa]ncia/i.test(text) ? 'Licença Sanitária' : 'Alvará de Funcionamento'),
      orgao: find(/(Prefeitura Municipal|Vigil[aâ]ncia Sanit[aá]ria|Corpo de Bombeiros|Secretaria do Meio Ambiente|SEMA|IAP|IMA|ANVISA|SEFAZ)/i) || 'Prefeitura Municipal',
      numero: find(/(N[ºo]\s*[:\-]?\s*([\w\-\/\.]+))/i) || find(/Processo\s*[:\-]?\s*([\w\-\/\.]+)/i),
      empresa: find(/(Empresa|Raz[aã]o Social)\s*[:\-]?\s*([A-Z0-9\.\-\&\s]{3,})/i) || '',
      municipio: find(/Munic[ií]pio\s*[:\-]?\s*([A-Za-z\s]{3,})/i) || '',
      uf: find(/\b(UF|Estado)\s*[:\-]?\s*([A-Z]{2})\b/i) || '',
      emissao: date(/Emiss[aã]o\s*[:\-]?\s*([0-9\/\-]{8,10})/i),
      vencimento: date(/Vencimento|Validade\s*[:\-]?\s*([0-9\/\-]{8,10})/i),
      responsavel: find(/Respons[aá]vel\s*[:\-]?\s*([A-Za-z\s]{3,})/i) || '',
      situacao: 'Normal'
    };

    setPdfSuggest(prev => ({ ...prev, ...sugestao }));
    setPdfSuggestOpen(true);
  } catch (err) {
    console.error('PDF import error', err);
    alert('Não foi possível ler este PDF agora. O restante do sistema segue normal.');
  } finally {
    e.target.value = '';
  }
  }

  const Header = () => (
    <header className="flex items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center text-white font-bold">Eb</div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-brand">Eb Control</h1>
          <p className="text-sm text-brand-700/80">Controle de alvarás, AVCB e licenças sanitárias — simples e objetivo.</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Primary onClick={handleExportCSV}><Download size={16}/> Exportar CSV</Primary>
        <label className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white border border-brand-200 hover:bg-brand-100/60 cursor-pointer text-sm relative group">
          <Upload size={16}/> Importar CSV
          <input type="file" accept=".csv" className="hidden" onChange={handleImportCSV}/>
          <span className="absolute -top-9 left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition bg-brand text-white text-xs rounded-md px-2 py-1 shadow-soft">
            Colunas: id;tipo;orgao;numero;empresa;municipio;uf;emissao;vencimento;responsavel;situacao
          </span>
        </label>
        <Button onClick={exportPDF}><FileText size={16}/> Relatório PDF</Button>
        <label className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white border border-brand-200 hover:bg-brand-100/60 cursor-pointer text-sm">
  <FileUp size={16}/> Importar PDF (beta)
  <input type="file" accept="application/pdf" className="hidden" onChange={handleImportPDF} />
</label>
        <button onClick={handleDownloadTemplate} className="inline-flex items-center gap-1 p-2 rounded-xl border border-brand-100 hover:bg-brand-100/60" title="Baixar modelo CSV padrão">
          <Info size={16}/> ?
        </button>
        <Button onClick={()=>{ if(confirm("Zerar todos os registros?")) setItems([]); }} className="text-brand-800 border-brand-200">
          <Trash2 size={16}/> Limpar
        </Button>
      </div>
    </header>
  );

  const ToggleHandle = () => (
    <button
      onClick={()=>setSidebarOpen(o=>!o)}
      className="fixed z-30 bg-brand text-white rounded-l-xl shadow-soft hover:bg-brand-800 focus:outline-none"
      style={{top:"120px", right: sidebarOpen ? `${SIDEBAR_W}px` : 0, transition:"right 300ms ease"}}
      title={sidebarOpen?"Recolher painel":"Abrir painel"} aria-label={sidebarOpen?"Recolher painel":"Abrir painel"}
    >
      <span className="inline-flex items-center justify-center w-7 h-9">
        {sidebarOpen ? <ChevronRight size={18}/> : <ChevronLeft size={18}/>}
      </span>
    </button>
  );

  return (
    <div className="min-h-screen bg-white text-brand-900">
      {/* Painel lateral */}
      <aside className={`fixed right-0 top-0 h-screen ${sidebarOpen?'w-80':'w-0'} bg-white border-l border-brand-100 shadow-soft p-4 z-20 overflow-y-auto transition-all duration-300`}>
        {sidebarOpen && (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-brand"/>
                <span className="font-medium text-brand">Mais próximos do vencimento</span>
              </div>
            </div>
            <div className="space-y-2">
              {sidebarList.map(it=>(
                <div key={it.id} className="rounded-xl border border-brand-100 p-3 hover:bg-brand-100/60 transition">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{it.tipo}</div>
                    <Badge className={statusColor(it.status)}>{it.status}</Badge>
                  </div>
                  <div className="text-xs text-brand-700/90 mt-1">{it.empresa} • {it.municipio}/{it.uf}</div>
                  <div className="text-xs mt-1"><span className="font-semibold text-brand-800">Vence:</span> {formatBR(it.vencimento)} ({isNaN(it.dias)?'-':(it.dias>=0?`em ${it.dias}d`:`${Math.abs(it.dias)}d atrasado`)})</div>
                  <div className="text-xs mt-1"><span className="font-semibold">Situação:</span> <Badge className={situacaoColor(it.situacao)}>{it.situacao}</Badge></div>
                  <div className="mt-2 flex items-center gap-2">
                    <Button onClick={()=>{ const ics=icsForItem(it); download(`${it.tipo}-${it.empresa}.ics`, ics, "text/calendar"); }}>ICS</Button>
                    <Button onClick={()=>{ window.scrollTo({top:0,behavior:"smooth"}); setEditingId(it.id); setForm({...it}); }}><Edit3 size={16}/> Editar</Button>
                  </div>
                </div>
              ))}
              {!sidebarList.length && <div className="text-sm text-brand-700/70">Sem registros.</div>}
            </div>
          </>
        )}
      </aside>
      <ToggleHandle/>

      {/* Conteúdo principal */}
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 ${sidebarOpen?'pr-80':'pr-6'}`}>
        <Header/>

        {/* Formulário */}
        <motion.div initial={{opacity:0,y:6}} animate={{opacity:1,y:0}}>
          <div className="bg-white rounded-2xl shadow-soft border border-brand-100">
            <div className="px-5 pt-4 pb-2 border-b border-brand-100">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-brand-800">{editingId?"Editar Registro":"Novo Registro"}</h2>
                <div className="flex items-center gap-2">
                  <Button onClick={()=>{ setForm({...DEFAULT_FORM, emissao:todayISO(), vencimento:""}); setEditingId(null); }}>Limpar</Button>
                  <Primary form="lic-form" type="submit"><Plus size={16}/> {editingId?"Salvar":"Cadastrar"}</Primary>
                </div>
              </div>
            </div>
            <div className="px-5 py-4">
              <form id="lic-form" className="grid md:grid-cols-5 gap-4" onSubmit={addOrUpdate}>
                <div className="md:col-span-2">
                  <Label>Tipo *</Label>
                  <Select value={form.tipo} onChange={e=>setForm(f=>({...f, tipo:e.target.value}))} required>
                    {["Alvará de Funcionamento","AVCB (Bombeiros)","Licença Sanitária","Licença Ambiental","Outro"].map(t=><option key={t} value={t}>{t}</option>)}
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label>Órgão emissor *</Label>
                  <Input list="orgaos" value={form.orgao} onChange={e=>setForm(f=>({...f, orgao:e.target.value}))} placeholder="Prefeitura Municipal / VISA / CBM" required/>
                  <datalist id="orgaos">{ORGAOS_SUG.map(o=><option key={o} value={o}/>)}</datalist>
                </div>
                <div>
                  <Label>Número</Label>
                  <Input value={form.numero} onChange={e=>setForm(f=>({...f, numero:e.target.value}))} placeholder="Ex.: 12345"/>
                </div>
                <div>
                  <Label>Empresa *</Label>
                  <Input value={form.empresa} onChange={e=>setForm(f=>({...f, empresa:e.target.value}))} placeholder="Ex.: Loja Centro" required/>
                </div>
                <div>
                  <Label>Município *</Label>
                  <Input value={form.municipio} onChange={e=>setForm(f=>({...f, municipio:e.target.value}))} placeholder="Ex.: Cascavel" required/>
                </div>
                <div>
                  <Label>UF *</Label>
                  <Select value={form.uf} onChange={e=>setForm(f=>({...f, uf:e.target.value}))} required>
                    <option value="">Selecione</option>
                    {UF_LIST.map(uf=><option key={uf} value={uf}>{uf}</option>)}
                  </Select>
                </div>
                <div>
                  <Label>Emissão</Label>
                  <Input type="date" value={form.emissao} onChange={e=>setForm(f=>({...f, emissao:e.target.value}))}/>
                </div>
                <div>
                  <Label>Vencimento *</Label>
                  <Input type="date" value={form.vencimento} onChange={e=>setForm(f=>({...f, vencimento:e.target.value}))} required/>
                </div>
                <div className="md:col-span-2">
                  <Label>Responsável *</Label>
                  <Input value={form.responsavel} onChange={e=>setForm(f=>({...f, responsavel:e.target.value}))} placeholder="Quem renova?" required/>
                </div>
                <div>
                  <Label>Situação *</Label>
                  <Select value={form.situacao} onChange={e=>setForm(f=>({...f, situacao:e.target.value}))}>
                    <option value={SITUACAO.NORMAL}>{SITUACAO.NORMAL}</option>
                    <option value={SITUACAO.RENOVACAO}>{SITUACAO.RENOVACAO}</option>
                  </Select>
                  {form.situacao === SITUACAO.RENOVACAO && (
  <>
    <div className="md:col-span-2">
      <Label>Protocolo</Label>
      <Input
        value={form.protocolo || ""}
        onChange={e => setForm(f => ({ ...f, protocolo: e.target.value }))}
        placeholder="Ex.: 2025/000123-45"
      />
    </div>
    <div>
      <Label>Novo prazo</Label>
      <Input
        type="date"
        value={form.renovacao_prazo || ""}
        onChange={e => setForm(f => ({ ...f, renovacao_prazo: e.target.value }))}
      />
    </div>
    <div className="md:col-span-5">
      <Label>Observação</Label>
      <Input
        value={form.observacao || ""}
        onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
        placeholder="Ex.: Guia enviada em 10/10, aguardando análise."
      />
    </div>
  </>
)}

                </div>
              </form>
            </div>
          </div>
        </motion.div>

        {/* Filtros */}
        <div className="mt-6 grid md:grid-cols-4 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-2.5 text-brand-700" size={16}/>
            <Input className="pl-9" placeholder="Buscar por tipo, órgão, número, empresa, responsável…" value={query} onChange={e=>setQuery(e.target.value)}/>
          </div>
          <Select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
            <option value="">Status (todos)</option>
            {Object.values(STATUS).map(s=><option key={s} value={s}>{s}</option>)}
          </Select>
          <Select value={tipoFilter} onChange={e=>setTipoFilter(e.target.value)}>
            <option value="">Tipo (todos)</option>
            {tipos.map(t=><option key={t} value={t}>{t}</option>)}
          </Select>
          <Select value={empresaFilter} onChange={e=>setEmpresaFilter(e.target.value)}>
            <option value="">Empresa (todas)</option>
            {empresas.map(u=><option key={u} value={u}>{u}</option>)}
          </Select>
        </div>

        {/* Dashboard */}
        <div className="mt-6 grid lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl shadow-soft border border-brand-100 lg:col-span-1">
            <div className="px-5 pt-4 pb-2 border-b border-brand-100">
              <div className="flex items-center gap-2 text-brand"><AlertTriangle size={18}/> <span className="font-medium">Status geral</span></div>
            </div>
            <div className="px-5 py-4">
              <div className="grid grid-cols-2 gap-2 mb-4">
                {countsByStatus.map(({name,value})=>(
                  <div key={name} className="flex items-center justify-between bg-brand-100 rounded-xl px-3 py-2">
                    <span className="text-sm">{name}</span>
                    <Badge className={statusColor(name)}>{value}</Badge>
                  </div>
                ))}
              </div>
              <div className="flex justify-center">
                <PieChart width={260} height={220}>
                  <Pie
                    data={Object.entries(tipos.reduce((m,t)=>({...m,[t]:enriched.filter(i=>i.tipo===t).length}),{})).map(([name,value])=>({name,value}))}
                    dataKey="value" nameKey="name" outerRadius={80}
                  >
                    {Object.entries(tipos.reduce((m,t)=>({...m,[t]:enriched.filter(i=>i.tipo===t).length}),{})).map((_,i)=><Cell key={i}/>)}
                  </Pie>
                  <ReTooltip/>
                </PieChart>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-soft border border-brand-100 lg:col-span-2">
            <div className="px-5 pt-4 pb-2 border-b border-brand-100">
              <div className="flex items-center gap-2 text-brand"><Calendar size={18}/> <span className="font-medium">Vencimentos — próximos 12 meses</span></div>
            </div>
            <div className="px-5 py-4">
              <div style={{width:"100%",overflowX:"auto"}}>
                <BarChart width={700} height={260} data={barData} className="w-full">
                  <CartesianGrid strokeDasharray="3 3"/>
                  <XAxis dataKey="mes"/><YAxis allowDecimals={false}/>
                  <ReTooltip/><Legend/><Bar dataKey="Vencimentos"/>
                </BarChart>
              </div>
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-2xl shadow-soft border border-brand-100 mt-6">
          <div className="px-5 pt-4 pb-2 border-b border-brand-100">
            <div className="flex items-center justify-between">
              <div className="font-medium text-brand-800">Registros ({filtered.length})</div>
              <div className="text-xs text-brand-700/70">Use o painel lateral para agir rápido.</div>
            </div>
          </div>
          <div className="px-5 py-4">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-brand-800 border-b">
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Tipo</th>
                    <th className="py-2 pr-3">Órgão</th>
                    <th className="py-2 pr-3">Número</th>
                    <th className="py-2 pr-3">Empresa</th>
                    <th className="py-2 pr-3">Município/UF</th>
                    <th className="py-2 pr-3">Emissão</th>
                    <th className="py-2 pr-3">Vencimento</th>
                    <th className="py-2 pr-3">Dias</th>
                    <th className="py-2 pr-3">Responsável</th>
                    <th className="py-2 pr-3">Situação</th>
                    <th className="py-2 pr-3">Ações</th>
                    <th className="py-2 pr-3">Protocolo</th>
                    <th className="py-2 pr-3">Novo prazo</th>
                    <th className="py-2 pr-3">Obs.</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(it=>(
                    <tr key={it.id} className="border-b last:border-0 hover:bg-brand-100/60">
                      <td className="py-2 pr-3"><Badge className={statusColor(it.status)}>{it.status}</Badge></td>
                      <td className="py-2 pr-3">{it.tipo}</td>
                      <td className="py-2 pr-3">{it.orgao}</td>
                      <td className="py-2 pr-3">{it.numero}</td>
                      <td className="py-2 pr-3">{it.empresa}</td>
                      <td className="py-2 pr-3">{it.municipio}/{it.uf}</td>
                      <td className="py-2 pr-3">{formatBR(it.emissao)}</td>
                      <td className="py-2 pr-3 font-medium">{formatBR(it.vencimento)}</td>
                      <td className="py-2 pr-3">{isNaN(it.dias)?'-':it.dias}</td>
                      <td className="py-2 pr-3">{it.responsavel}</td>
                      <td className="py-2 pr-3"><Badge className={situacaoColor(it.situacao)}>{it.situacao}</Badge></td>
                      <td className="py-2 pr-3">{it.protocolo || "-"}</td>
                      <td className="py-2 pr-3">{it.renovacao_prazo ? formatBR(it.renovacao_prazo) : "-"}</td>
                      <td className="py-2 pr-3 truncate max-w-[240px]">{it.observacao || "-"}</td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2">
                          <Button onClick={()=>handleEdit(it)} title="Editar"><Edit3 size={16}/>Editar</Button>
                          <Button onClick={()=>{ const ics=icsForItem(it); download(`${it.tipo}-${it.empresa}.ics`, ics, "text/calendar"); }} title="Gerar evento (ICS)"><Calendar size={16}/>ICS</Button>
                          <Button onClick={()=>handleDelete(it.id)} className="border-red-200 text-red-700 hover:bg-red-50" title="Excluir"><Trash2 size={16}/>Excluir</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length===0 && <tr><td colSpan={12} className="py-6 text-center text-brand-700/70">Nenhum registro com os filtros atuais.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <footer className="text-xs text-brand-700/70 mt-6">
          <p>Dados salvos no navegador (localStorage). Para uso em equipe, publicar com backend (Supabase/Firebase/Postgres) e trocar persistência.</p>
        </footer>
      </div>

      {/* Pré-cadastro (CSV) */}
      <Modal
        open={previewOpen}
        onClose={()=>setPreviewOpen(false)}
        title="Pré-cadastro — revisar itens antes de salvar"
        footer={<><Button onClick={()=>setPreviewOpen(false)}>Cancelar</Button><Primary onClick={confirmImport}>Cadastrar selecionados</Primary></>}
      >
        <div className="text-sm text-brand-700/80 mb-2">Revise os registros lidos do CSV. Desmarque os que não deseja importar.</div>
        <div className="overflow-auto max-h-[55vh] border border-brand-100 rounded-xl">
          <table className="min-w-full text-sm">
            <thead className="bg-brand-100 sticky top-0">
              <tr className="text-left">
                <th className="py-2 px-2">✓</th>
                <th className="py-2 px-2">Tipo</th>
                <th className="py-2 px-2">Órgão</th>
                <th className="py-2 px-2">Número</th>
                <th className="py-2 px-2">Empresa</th>
                <th className="py-2 px-2">Município</th>
                <th className="py-2 px-2">UF</th>
                <th className="py-2 px-2">Emissão</th>
                <th className="py-2 px-2">Vencimento</th>
                <th className="py-2 px-2">Responsável</th>
                <th className="py-2 px-2">Situação</th>
                <th className="py-2 pr-3">Protocolo</th>
                <th className="py-2 pr-3">Novo prazo</th>
                <th className="py-2 pr-3">Obs.</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map(row=>{
                const key=row.id||row._tmpId; const checked=!!selectedRows[key];
                return (
                  <tr key={key} className="border-b">
                    <td className="px-2 py-1"><input type="checkbox" checked={checked} onChange={e=>setSelectedRows(s=>({...s,[key]:e.target.checked}))}/></td>
                    <td className="px-2 py-1">{row.tipo}</td>
                    <td className="px-2 py-1">{row.orgao}</td>
                    <td className="px-2 py-1">{row.numero}</td>
                    <td className="px-2 py-1">{row.empresa}</td>
                    <td className="px-2 py-1">{row.municipio}</td>
                    <td className="px-2 py-1">{row.uf}</td>
                    <td className="px-2 py-1">{row.emissao}</td>
                    <td className="px-2 py-1">{row.vencimento}</td>
                    <td className="px-2 py-1">{row.responsavel}</td>
                    <td className="px-2 py-1">{row.situacao}</td>
                    <td className="py-2 pr-3">{it.protocolo || "-"}</td>
                    <td className="py-2 pr-3">{it.renovacao_prazo ? formatBR(it.renovacao_prazo) : "-"}</td>
                    <td className="py-2 pr-3 truncate max-w-[240px]">{it.observacao || "-"}</td>
                  </tr>
                );
              })}
              {!previewRows.length && <tr><td colSpan={11} className="text-center text-brand-700/70 py-3">Nenhum registro lido.</td></tr>}
            </tbody>
          </table>
        </div>
      </Modal>

      {/* Sugestão por PDF (beta) */}
      <Modal
        open={pdfSuggestOpen}
        onClose={()=>setPdfSuggestOpen(false)}
        title="Sugestão a partir do PDF (beta)"
        footer={<><Button onClick={()=>setPdfSuggestOpen(false)}>Fechar</Button><Primary onClick={()=>{ setForm(pdfSuggest); setPdfSuggestOpen(false); window.scrollTo({top:0,behavior:"smooth"}); }}>Aplicar ao formulário</Primary></>}
      >
        <div className="grid md:grid-cols-3 gap-3 text-sm">
          <div><Label>Tipo</Label><Input value={pdfSuggest.tipo} onChange={e=>setPdfSuggest(s=>({...s, tipo:e.target.value}))}/></div>
          <div><Label>Órgão</Label><Input value={pdfSuggest.orgao} onChange={e=>setPdfSuggest(s=>({...s, orgao:e.target.value}))}/></div>
          <div><Label>Número</Label><Input value={pdfSuggest.numero} onChange={e=>setPdfSuggest(s=>({...s, numero:e.target.value}))}/></div>
          <div><Label>Empresa</Label><Input value={pdfSuggest.empresa} onChange={e=>setPdfSuggest(s=>({...s, empresa:e.target.value}))}/></div>
          <div><Label>Município</Label><Input value={pdfSuggest.municipio} onChange={e=>setPdfSuggest(s=>({...s, municipio:e.target.value}))}/></div>
          <div><Label>UF</Label><Input value={pdfSuggest.uf} onChange={e=>setPdfSuggest(s=>({...s, uf:e.target.value.toUpperCase().slice(0,2)}))}/></div>
          <div><Label>Emissão</Label><Input type="date" value={pdfSuggest.emissao} onChange={e=>setPdfSuggest(s=>({...s, emissao:e.target.value}))}/></div>
          <div><Label>Vencimento</Label><Input type="date" value={pdfSuggest.vencimento} onChange={e=>setPdfSuggest(s=>({...s, vencimento:e.target.value}))}/></div>
          <div><Label>Responsável</Label><Input value={pdfSuggest.responsavel} onChange={e=>setPdfSuggest(s=>({...s, responsavel:e.target.value}))}/></div>
          <div>
            <Label>Situação</Label>
            <Select value={pdfSuggest.situacao} onChange={e=>setPdfSuggest(s=>({...s, situacao:e.target.value}))}>
              <option value={SITUACAO.NORMAL}>{SITUACAO.NORMAL}</option>
              <option value={SITUACAO.RENOVACAO}>{SITUACAO.RENOVACAO}</option>
            </Select>
          </div>
        </div>
        <p className="text-xs text-brand-700/70 mt-3">Observação: leitura automática é experimental e pode não reconhecer todos os PDFs. Revise os campos antes de aplicar.</p>
      </Modal>
    </div>
  );
}

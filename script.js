// script.js — módulo ES (coleções: impressoras-site1 e impressoras-toners)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, onSnapshot, query, orderBy,
  doc, updateDoc, getDocs, where, deleteDoc
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js";

/* ====== firebaseConfig (use a sua configuração fornecida) ====== */
const firebaseConfig = {
  apiKey: "AIzaSyBSAMAhiEbBPCNqNpv-dM64Pa_xclwqc54",
  authDomain: "controletoner.firebaseapp.com",
  projectId: "controletoner",
  storageBucket: "controletoner.firebasestorage.app",
  messagingSenderId: "821741941730",
  appId: "1:821741941730:web:32bd9d82c58deef8a37fbb",
  measurementId: "G-HVQ1MN2HBD"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ====== helpers ====== */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const escapeHtml = s => String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

/* ====== DOM elements ====== */
const tabelaRegistrosBody = $("#tabelaRegistros tbody");
const tabelaTonersBody = $("#tabelaToners tbody");
const tabelaConsultaBody = $("#tabelaConsulta tbody");

const formRegistro = $("#formRegistro");
const escolaInput = $("#escola");
const modeloInput = $("#modelo");
const quantidadeInput = $("#quantidade");
const dataInput = $("#data");
const tipoOperacao = $("#tipoOperacao");
const btnSalvar = $("#btnSalvar");
const btnCancelarEdicao = $("#btnCancelarEdicao");

const filtroEscola = $("#filtroEscola");
const filtroMes = $("#filtroMes");
const btnImprimirTodos = $("#btnImprimirTodos");
const btnImprimirFiltrado = $("#btnImprimirFiltrado");
const btnExportPDF = $("#btnExportPDF");

const formCadastroToner = $("#formCadastroToner");
const cadModelo = $("#cadModelo");
const cadQuantidade = $("#cadQuantidade");
const cadImpressora = $("#cadImpressora");
const btnSalvarToner = $("#btnSalvarToner");
const btnCancelarToner = $("#btnCancelarToner");
const filtroModeloConsulta = $("#filtroModeloConsulta");

const dlEscolas = $("#listaEscolas");
const dlModelos = $("#listaModelos");

/* ====== coleções ====== */
const colecaoRegistros = collection(db, "impressoras-site1");
const colecaoToners = collection(db, "impressoras-toners");

/* ====== estado local ====== */
let registros = [];
let toners = [];
let idEdicaoRegistro = null;
let idEdicaoToner = null;

/* ====== util: setar data hoje ====== */
function setToday() {
  const hoje = new Date().toISOString().split("T")[0];
  dataInput.value = hoje;
}
setToday();

/* ====== navegação abas ====== */
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".tab-btn").forEach(b =>
      b.classList.remove("active")
    );
    document.querySelectorAll(".tab").forEach(sec =>
      sec.classList.remove("active")
    );

    btn.classList.add("active");

    const alvo = btn.getAttribute("data-target");
    const sec = document.getElementById(alvo);

    if (!sec) {
      console.error("Seção não encontrada:", alvo);
      alert("Erro: seção não encontrada!");
      return;
    }

    sec.classList.add("active");
  };
});


/* ====== popular datalists ====== */
async function popularDatalists() {
  try {
    // escolas únicas a partir de registros
    const snapR = await getDocs(query(colecaoRegistros, orderBy("escola")));
    const setEscolas = new Set();
    snapR.forEach(s => { const d = s.data(); if(d && d.escola) setEscolas.add(d.escola); });
    dlEscolas.innerHTML = "";
    Array.from(setEscolas).sort().forEach(nome => {
      const opt = document.createElement("option"); opt.value = nome; dlEscolas.appendChild(opt);
    });

    // modelos a partir de toners
    const snapT = await getDocs(query(colecaoToners, orderBy("modelo")));
    const setModelos = new Set();
    snapT.forEach(s => { const d = s.data(); if(d && d.modelo) setModelos.add(d.modelo); });
    dlModelos.innerHTML = "";
    Array.from(setModelos).sort().forEach(m => {
      const opt = document.createElement("option"); opt.value = m; dlModelos.appendChild(opt);
    });
  } catch (e) {
    console.warn("Erro popular datalists:", e);
  }
}

/* ====== observar registros (onSnapshot) ====== */
function observarRegistros() {
  const q = query(colecaoRegistros, orderBy("data", "desc"));
  onSnapshot(q, snap => {
    registros = [];
    tabelaRegistrosBody.innerHTML = "";
    snap.forEach(docSnap => {
      const d = docSnap.data();
      const id = docSnap.id;
      registros.push({...d, id});
      const tr = document.createElement("tr");
      tr.dataset.id = id;
      tr.innerHTML = `
        <td>${escapeHtml(d.escola || "")}</td>
        <td>${escapeHtml(d.modelo || "")}</td>
        <td>${d.quantidade ?? ""}</td>
        <td>${d.data ?? ""}</td>
        <td>${escapeHtml(d.tipo || "")}</td>
        <td>
          <button class="btn-editar" data-id="${id}">✏️</button>
          <button class="btn-excluir" data-id="${id}">🗑️</button>
        </td>
      `;
      tabelaRegistrosBody.appendChild(tr);
    });
    aplicarEventosRegistros();
    aplicarFiltroTabela(); // reaplica filtro quando dados mudam
    popularDatalists();
  }, err => console.error("Erro snapshot registros:", err));
}
observarRegistros();

/* ====== observar toners ====== */
function observarToners() {
  const q = query(colecaoToners, orderBy("modelo"));
  onSnapshot(q, snap => {
    toners = [];
    tabelaTonersBody.innerHTML = "";
    tabelaConsultaBody.innerHTML = "";
    dlModelos.innerHTML = "";
    snap.forEach(docSnap => {
      const d = docSnap.data(); const id = docSnap.id;
      toners.push({...d, id});
      const tr = document.createElement("tr");
      tr.dataset.id = id;
      tr.innerHTML = `
        <td>${escapeHtml(d.modelo || "")}</td>
        <td>${d.quantidade ?? 0}</td>
        <td>${escapeHtml(d.impressora || "")}</td>
        <td>
          <button class="btn-editar-toner" data-id="${id}">✏️</button>
          <button class="btn-excluir-toner" data-id="${id}">🗑️</button>
        </td>
      `;
      tabelaTonersBody.appendChild(tr);

      const tr2 = document.createElement("tr");
      tr2.innerHTML = `<td>${escapeHtml(d.modelo || "")}</td><td>${d.quantidade ?? 0}</td><td>${escapeHtml(d.impressora || "")}</td>`;
      tabelaConsultaBody.appendChild(tr2);

      const opt = document.createElement("option"); opt.value = d.modelo || ""; dlModelos.appendChild(opt);
    });
    aplicarEventosToners();
    popularDatalists();
  }, err => console.error("Erro snapshot toners:", err));
}
observarToners();

/* ====== eventos registros (editar/excluir) ====== */
function aplicarEventosRegistros() {
  $$(".btn-excluir").forEach(btn=>{
    btn.onclick = async ()=> {
      if(!confirm("Deseja excluir este registro?")) return;
      try { await deleteDoc(doc(db, "impressoras-site1", btn.dataset.id)); }
      catch(e){ console.error("Erro excluir registro:", e); alert("Erro ao excluir"); }
    };
  });

  $$(".btn-editar").forEach(btn=>{
    btn.onclick = ()=> {
      const id = btn.dataset.id;
      const item = registros.find(r=> r.id === id);
      if(!item) return;
      idEdicaoRegistro = id;
      escolaInput.value = item.escola || "";
      modeloInput.value = item.modelo || "";
      quantidadeInput.value = item.quantidade ?? 1;
      dataInput.value = item.data || new Date().toISOString().split("T")[0];
      tipoOperacao.value = item.tipo || "";
      btnSalvar.textContent = "Salvar Alterações";
      btnCancelarEdicao.style.display = "inline-block";
      window.scrollTo({top:0, behavior:'smooth'});
    };
  });
}

/* ====== submit registro ====== */
/* Regra A: Troca → desconta do estoque; Recarga → não altera estoque */
formRegistro.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const novo = {
    escola: escolaInput.value.trim(),
    modelo: modeloInput.value.trim(),
    quantidade: Number(quantidadeInput.value),
    data: dataInput.value,
    tipo: tipoOperacao.value
  };
  if(!novo.escola || !novo.modelo || !novo.data || !novo.tipo || isNaN(novo.quantidade) || novo.quantidade <= 0){
    return alert("Preencha todos os campos corretamente.");
  }

  try {
    if(idEdicaoRegistro) {
      await updateDoc(doc(db, "impressoras-site1", idEdicaoRegistro), novo);
      alert("Registro atualizado!");
      idEdicaoRegistro = null;
      formRegistro.reset();
      setToday();
      btnSalvar.textContent = "Registrar";
      btnCancelarEdicao.style.display = "none";
      return;
    }

    if(novo.tipo === "Recarga") {
      await addDoc(colecaoRegistros, novo);
      alert("Recarga registrada!");
      formRegistro.reset();
      setToday();
      return;
    }

    // Troca: buscar toner no estoque
    const q = query(colecaoToners, where("modelo", "==", novo.modelo));
    const qsnap = await getDocs(q);
    if(qsnap.empty) { return alert("Modelo não encontrado no estoque!"); }
    const tonerDoc = qsnap.docs[0];
    const tonerData = tonerDoc.data();
    const atual = Number(tonerData.quantidade || 0);
    const novaQtd = atual - novo.quantidade;
    if(novaQtd < 0) return alert("Estoque insuficiente!");
    // atualizar estoque então salvar registro
    await updateDoc(doc(db, "impressoras-toners", tonerDoc.id), { quantidade: novaQtd });
    await addDoc(colecaoRegistros, novo);
    alert("Troca registrada e estoque atualizado!");
    formRegistro.reset();
    setToday();
  } catch (err) {
    console.error("Erro salvar registro:", err);
    alert("Erro ao salvar (veja console).");
  }
});

/* ====== filtros em tempo real ====== */
function aplicarFiltroTabela() {
  const termo = (filtroEscola.value || "").toLowerCase();
  const mes = filtroMes.value; // YYYY-MM
  $$("#tabelaRegistros tbody tr").forEach(tr=>{
    const txt = tr.innerText.toLowerCase();
    const dataTxt = tr.children[3] ? tr.children[3].innerText : "";
    const condEscola = termo === "" || txt.includes(termo);
    const condMes = mes === "" || dataTxt.startsWith(mes);
    tr.style.display = (condEscola && condMes) ? "" : "none";
  });
}
filtroEscola.addEventListener("input", aplicarFiltroTabela);
filtroMes.addEventListener("change", aplicarFiltroTabela);

/* ====== impressão / PDF ====== */
function gerarHtmlRelatorio(lista) {
  let html = `<html><head><meta charset="utf-8"><title>Relatório</title>
    <style>body{font-family:Arial;padding:18px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#eee}</style>
    </head><body>`;
  html += `<h2>Relatório de Trocas e Recargas</h2><p>Emitido: ${new Date().toLocaleString()}</p>`;
  html += `<table><tr><th>Escola</th><th>Modelo</th><th>Quantidade</th><th>Data</th><th>Tipo</th></tr>`;
  lista.forEach(r=> html += `<tr><td>${escapeHtml(r.escola)}</td><td>${escapeHtml(r.modelo)}</td><td>${r.quantidade}</td><td>${r.data}</td><td>${escapeHtml(r.tipo)}</td></tr>`);
  html += `</table></body></html>`;
  return html;
}
btnImprimirTodos.addEventListener("click", ()=> {
  if(registros.length === 0) return alert("Sem registros.");
  const w = window.open(); w.document.write(gerarHtmlRelatorio(registros)); w.document.close(); w.print();
});
btnImprimirFiltrado.addEventListener("click", ()=> {
  const termo = (filtroEscola.value||"").toLowerCase();
  const mes = filtroMes.value;
  const filtrados = registros.filter(r => (termo === "" || r.escola.toLowerCase().includes(termo)) && (mes === "" || r.data.startsWith(mes)));
  if(filtrados.length === 0) return alert("Nenhum registro encontrado.");
  const w = window.open(); w.document.write(gerarHtmlRelatorio(filtrados)); w.document.close(); w.print();
});
btnExportPDF.addEventListener("click", ()=> {
  const termo = (filtroEscola.value||"").toLowerCase();
  const mes = filtroMes.value;
  const filtrados = registros.filter(r => (termo === "" || r.escola.toLowerCase().includes(termo)) && (mes === "" || r.data.startsWith(mes)));
  if(filtrados.length === 0) return alert("Nenhum registro para exportar.");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({orientation:'landscape'});
  doc.text("Relatório de Trocas e Recargas", 14, 14);
  doc.autoTable({ head:[['Escola','Modelo','Quantidade','Data','Tipo']], body: filtrados.map(r=>[r.escola, r.modelo, String(r.quantidade), r.data, r.tipo]), startY: 20 });
  doc.save('relatorio_trocas.pdf');
});

/* ====== toners: eventos editar/excluir e submit ====== */
function aplicarEventosToners(){
  $$(".btn-excluir-toner").forEach(btn=>{
    btn.onclick = async ()=> {
      if(!confirm("Excluir toner?")) return;
      try { await deleteDoc(doc(db, "impressoras-toners", btn.dataset.id)); }
      catch(e){ console.error("Erro excluir toner:", e); alert("Erro ao excluir toner"); }
    };
  });
  $$(".btn-editar-toner").forEach(btn=>{
    btn.onclick = async ()=> {
      const id = btn.dataset.id;
      const t = toners.find(x=> x.id === id);
      if(!t) return;
      idEdicaoToner = id;
      cadModelo.value = t.modelo || "";
      cadQuantidade.value = t.quantidade ?? 0;
      cadImpressora.value = t.impressora || "";
      btnSalvarToner.textContent = "Salvar Alterações";
      btnCancelarToner.style.display = "inline-block";
      window.scrollTo({top:0, behavior:'smooth'});
    };
  });
}
formCadastroToner.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const novo = { modelo: cadModelo.value.trim(), quantidade: Number(cadQuantidade.value), impressora: cadImpressora.value.trim() };
  if(!novo.modelo || isNaN(novo.quantidade) || novo.quantidade < 0 || !novo.impressora) return alert("Preencha os campos corretamente.");
  try {
    if(idEdicaoToner) {
      await updateDoc(doc(db, "impressoras-toners", idEdicaoToner), novo);
      alert("Toner atualizado!");
      idEdicaoToner = null;
      formCadastroToner.reset();
      btnSalvarToner.textContent = "Cadastrar";
      btnCancelarToner.style.display = "none";
      return;
    }
    await addDoc(colecaoToners, novo);
    alert("Toner cadastrado!");
    formCadastroToner.reset();
  } catch (err) {
    console.error("Erro salvar toner:", err);
    alert("Erro ao salvar toner.");
  }
});
btnCancelarToner.addEventListener("click", ()=>{
  idEdicaoToner = null;
  formCadastroToner.reset();
  btnSalvarToner.textContent = "Cadastrar";
  btnCancelarToner.style.display = "none";
});

/* ====== filtro consulta modelos ====== */
filtroModeloConsulta.addEventListener("input", (e)=>{
  const termo = (e.target.value||"").toLowerCase();
  $$("#tabelaConsulta tbody tr").forEach(tr=>{
    tr.style.display = tr.innerText.toLowerCase().includes(termo) ? "" : "none";
  });
});

/* ====== iniciar uma vez datalists ====== */
popularDatalists();

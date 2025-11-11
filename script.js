// script.js — versão ajustada para coleções existentes no Firestore
// Usa as coleções:
//  - impressoras-site1  (registros de troca/recarga)
//  - impressoras-toners (estoque de toners)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-app.js";
import { 
  getFirestore, collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, getDocs, where, deleteDoc 
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js";

// ---------------------------
// Substitua pelo seu firebaseConfig real (se já tiver no HTML, remova daqui)
// ---------------------------
const firebaseConfig = {
  apiKey: "AIzaSyBSAMAhiEbBPCNqNpv-dM64Pa_xclwqc54",
  authDomain: "controletoner.firebaseapp.com",
  projectId: "controletoner",
  storageBucket: "controletoner.firebasestorage.app",
  messagingSenderId: "821741941730",
  appId: "1:821741941730:web:32bd9d82c58deef8a37fbb"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ---------------------------
// Helper
// ---------------------------
function escapeHtml(str){ return String(str||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}

// ---------------------------
// Elements
// ---------------------------
const formRegistro = document.getElementById('formRegistro');
const tabelaRegistros = document.getElementById('tabelaRegistros'); // tbody
const escolaInput = document.getElementById('escola');
const modeloInput = document.getElementById('modelo');
const quantidadeInput = document.getElementById('quantidade');
const dataInput = document.getElementById('data');
const tipoOperacao = document.getElementById('tipoOperacao');
const btnSalvar = document.getElementById('btnSalvar');
const btnCancelarEdicao = document.getElementById('btnCancelarEdicao');
const filtroEscola = document.getElementById('filtroEscola');
const filtroMes = document.getElementById('filtroMes');
const btnImprimirTodos = document.getElementById('btnImprimirTodos');
const btnImprimirFiltrado = document.getElementById('btnImprimirFiltrado');

const formCadastroToner = document.getElementById('formCadastroToner');
const tabelaToners = document.getElementById('tabelaToners'); // tbody
const tabelaConsulta = document.getElementById('tabelaConsulta'); // tbody
const cadModelo = document.getElementById('cadModelo');
const cadQuantidade = document.getElementById('cadQuantidade');
const cadImpressora = document.getElementById('cadImpressora');
const filtroModeloConsulta = document.getElementById('filtroModeloConsulta');
const btnSalvarToner = document.getElementById('btnSalvarToner');
const btnCancelarToner = document.getElementById('btnCancelarToner');

const dlEscolas = document.getElementById('listaEscolas'); // datalist
const dlModelos = document.getElementById('listaModelos'); // datalist

// ---------------------------
// Collections (ajustadas aos nomes do seu Firestore)
// ---------------------------
const colecaoToners = collection(db, 'impressoras-toners');
const colecaoRegistros = collection(db, 'impressoras-site1');

// ---------------------------
// Estado local
// ---------------------------
let registros = []; // cache de registros (impressoras-site1)
let toners = [];    // cache de toners (impressoras-toners)
let idEmEdicaoRegistro = null;
let idEmEdicaoToner = null;

// ---------------------------
// Popular datalists (escolas e modelos) a partir do Firestore
// ---------------------------
async function popularDatalists(){
  // escolas: pegar nomes únicos de registros
  try{
    const snapR = await getDocs(query(colecaoRegistros, orderBy('escola')));
    const setEscolas = new Set();
    snapR.forEach(s=>{ const d = s.data(); if(d && d.escola) setEscolas.add(d.escola); });
    dlEscolas.innerHTML = '';
    Array.from(setEscolas).sort().forEach(nome=>{ const opt = document.createElement('option'); opt.value = nome; dlEscolas.appendChild(opt); });
  }catch(e){
    console.warn('Erro ao popular datalist de escolas:', e);
  }

  // modelos: a partir da coleção de toners
  try{
    const snapT = await getDocs(query(colecaoToners, orderBy('modelo')));
    const setModelos = new Set();
    snapT.forEach(s=>{ const d = s.data(); if(d && d.modelo) setModelos.add(d.modelo); });
    dlModelos.innerHTML = '';
    Array.from(setModelos).sort().forEach(m=>{ const opt = document.createElement('option'); opt.value = m; dlModelos.appendChild(opt); });
  }catch(e){
    console.warn('Erro ao popular datalist de modelos:', e);
  }
}

// ---------------------------
// Observadores em tempo real
// ---------------------------
function observarRegistros(){
  const q = query(colecaoRegistros, orderBy('data','desc'));
  onSnapshot(q, snap=>{
    registros = [];
    tabelaRegistros.innerHTML = '';
    snap.forEach(docSnap=>{
      const r = docSnap.data();
      registros.push({...r, id: docSnap.id});
      const tr = document.createElement('tr');
      tr.dataset.id = docSnap.id;
      tr.innerHTML = `
        <td>${escapeHtml(r.escola)}</td>
        <td>${escapeHtml(r.modelo)}</td>
        <td>${r.quantidade}</td>
        <td>${r.data}</td>
        <td>${escapeHtml(r.tipo)}</td>
        <td class="btn-acoes">
          <button class="btn-editar" data-id="${docSnap.id}">✏️</button>
          <button class="btn-excluir" data-id="${docSnap.id}">🗑️</button>
        </td>`;
      tabelaRegistros.appendChild(tr);
    });
    aplicarEventosRegistros();
    aplicarFiltroTabela(); // reaplica filtros quando dados mudam
    popularDatalists();
  }, err=> console.error('Erro onSnapshot registros:', err));
}

function observarToners(){
  const q = query(colecaoToners, orderBy('modelo'));
  onSnapshot(q, snap=>{
    toners = [];
    tabelaToners.innerHTML = '';
    tabelaConsulta.innerHTML = '';
    snap.forEach(docSnap=>{
      const d = docSnap.data();
      toners.push({...d, id: docSnap.id});
      const tr = document.createElement('tr');
      tr.dataset.id = docSnap.id;
      tr.innerHTML = `
        <td>${escapeHtml(d.modelo)}</td>
        <td>${d.quantidade}</td>
        <td>${escapeHtml(d.impressora)}</td>
        <td class="btn-acoes">
          <button class="btn-editar" data-id="${docSnap.id}">✏️</button>
          <button class="btn-excluir" data-id="${docSnap.id}">🗑️</button>
        </td>`;
      tabelaToners.appendChild(tr);

      const tr2 = document.createElement('tr');
      tr2.innerHTML = `<td>${escapeHtml(d.modelo)}</td><td>${d.quantidade}</td><td>${escapeHtml(d.impressora)}</td>`;
      tabelaConsulta.appendChild(tr2);
    });
    aplicarEventosToners();
    popularDatalists();
  }, err=> console.error('Erro onSnapshot toners:', err));
}

// iniciar observadores
observarRegistros();
observarToners();

// ---------------------------
// Eventos de edição/exclusão (registros)
// ---------------------------
function aplicarEventosRegistros(){
  document.querySelectorAll('.btn-excluir').forEach(btn=>{
    btn.onclick = async ()=>{
      if(confirm('Deseja excluir este registro?')){
        try{ await deleteDoc(doc(db,'impressoras-site1', btn.dataset.id)); }
        catch(e){ console.error('Erro excluir registro:', e); alert('Erro ao excluir registro'); }
      }
    };
  });
  document.querySelectorAll('.btn-editar').forEach(btn=>{
    btn.onclick = ()=>{
      const r = registros.find(rr=> rr.id === btn.dataset.id);
      if(!r) return;
      idEmEdicaoRegistro = r.id;
      escolaInput.value = r.escola || '';
      modeloInput.value = r.modelo || '';
      quantidadeInput.value = r.quantidade || '';
      dataInput.value = r.data || '';
      tipoOperacao.value = r.tipo || '';
      btnSalvar.textContent = 'Salvar Alterações';
      btnCancelarEdicao.style.display = 'inline-block';
      window.scrollTo({top:0, behavior:'smooth'});
    };
  });
}

// cancelar edição registro
btnCancelarEdicao.onclick = ()=>{
  idEmEdicaoRegistro = null;
  formRegistro.reset();
  btnSalvar.textContent = 'Registrar';
  btnCancelarEdicao.style.display = 'none';
};

// ---------------------------
// Submeter formulário de registro (troca/recarga)
// Regra escolhida: A -> para Troca desconta do estoque; para Recarga não altera estoque
// ---------------------------
formRegistro.addEventListener('submit', async (ev)=>{
  ev.preventDefault();
  const novo = {
    escola: escolaInput.value.trim(),
    modelo: modeloInput.value.trim(),
    quantidade: parseInt(quantidadeInput.value,10),
    data: dataInput.value,
    tipo: tipoOperacao.value
  };
  if(!novo.escola || !novo.modelo || isNaN(novo.quantidade) || !novo.data || !novo.tipo){
    alert('Preencha todos os campos corretamente.');
    return;
  }

  try{
    // edição
    if(idEmEdicaoRegistro){
      await updateDoc(doc(db,'impressoras-site1', idEmEdicaoRegistro), novo);
      alert('Registro atualizado!');
      idEmEdicaoRegistro = null;
      formRegistro.reset();
      btnSalvar.textContent = 'Registrar';
      btnCancelarEdicao.style.display = 'none';
      return;
    }

    // nova entrada
    if(novo.tipo === 'Recarga'){
      await addDoc(colecaoRegistros, novo);
      alert('Recarga registrada!');
      formRegistro.reset();
      return;
    }

    // Troca: checar estoque e atualizar (coleção impressoras-toners)
    const q = query(colecaoToners, where('modelo','==', novo.modelo));
    const qsnap = await getDocs(q);
    if(qsnap.empty){ alert('Modelo não encontrado no estoque!'); return; }
    const tonerDoc = qsnap.docs[0];
    const tonerData = tonerDoc.data();
    const novaQtd = (tonerData.quantidade || 0) - novo.quantidade;
    if(novaQtd < 0){ alert('Estoque insuficiente!'); return; }

    // atualizar estoque e registrar a troca
    await updateDoc(doc(db,'impressoras-toners', tonerDoc.id), { quantidade: novaQtd });
    await addDoc(colecaoRegistros, novo);
    alert('Troca registrada e estoque atualizado!');
    formRegistro.reset();
  }catch(err){
    console.error('Erro ao salvar registro:', err);
    alert('Erro ao salvar registro. Veja console.');
  }
});

// ---------------------------
// Filtragem em tempo real (escola e mês)
// ---------------------------
filtroEscola.addEventListener('input', aplicarFiltroTabela);
filtroMes.addEventListener('change', aplicarFiltroTabela);

function aplicarFiltroTabela(){
  const termo = filtroEscola.value.trim().toLowerCase();
  const mes = filtroMes.value; // AAAA-MM
  document.querySelectorAll('#tabelaRegistros tr').forEach(tr=>{
    const txt = tr.innerText.toLowerCase();
    const dataTxt = tr.children[3] ? tr.children[3].innerText : '';
    const condEscola = termo === '' || txt.includes(termo);
    const condMes = mes === '' || dataTxt.startsWith(mes);
    tr.style.display = (condEscola && condMes) ? '' : 'none';
  });
}

// ---------------------------
// Impressão / Relatório (abre em nova janela)
// ---------------------------
function gerarHtmlRelatorio(lista){
  let html = `<html><head><meta charset="utf-8"><title>Relatório</title>`;
  html += `<style>body{font-family:Arial;padding:18px} table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#eee}</style>`;
  html += `</head><body>`;
  html += `<h2>Relatório de Trocas e Recargas</h2>`;
  html += `<p>Emitido em ${new Date().toLocaleString()}</p>`;
  html += `<table><tr><th>Escola</th><th>Modelo</th><th>Quantidade</th><th>Data</th><th>Tipo</th></tr>`;
  lista.forEach(r=> html += `<tr><td>${escapeHtml(r.escola)}</td><td>${escapeHtml(r.modelo)}</td><td>${r.quantidade}</td><td>${r.data}</td><td>${escapeHtml(r.tipo)}</td></tr>`);
  html += `</table></body></html>`;
  return html;
}

btnImprimirTodos.onclick = ()=>{
  if(registros.length === 0){ alert('Sem registros.'); return; }
  const w = window.open(); w.document.write(gerarHtmlRelatorio(registros)); w.document.close(); w.print();
};

btnImprimirFiltrado.onclick = ()=>{
  const termo = filtroEscola.value.trim().toLowerCase();
  const mes = filtroMes.value;
  const filtrados = registros.filter(r=>{
    const condEscola = termo === '' || r.escola.toLowerCase().includes(termo);
    const condMes = mes === '' || r.data.startsWith(mes);
    return condEscola && condMes;
  });
  if(filtrados.length === 0){ alert('Nenhum registro encontrado.'); return; }
  const w = window.open(); w.document.write(gerarHtmlRelatorio(filtrados)); w.document.close(); w.print();
};

// ---------------------------
// CADASTRO/EDIÇÃO/EXCLUSÃO TONERS
// ---------------------------
function aplicarEventosToners(){
  document.querySelectorAll('#tabelaToners .btn-excluir').forEach(btn=>{
    btn.onclick = async ()=>{ if(confirm('Excluir este toner?')){ try{ await deleteDoc(doc(db,'impressoras-toners', btn.dataset.id)); }catch(e){console.error(e); alert('Erro ao excluir toner'); } } };
  });
  document.querySelectorAll('#tabelaToners .btn-editar').forEach(btn=>{
    btn.onclick = async ()=>{
      // buscar documento diretamente por ID
      try{
        const qs = await getDocs(query(colecaoToners, where('__name__','==', btn.dataset.id)));
        if(!qs.empty){
          const d = qs.docs[0].data();
          idEmEdicaoToner = btn.dataset.id;
          cadModelo.value = d.modelo || '';
          cadQuantidade.value = d.quantidade || 0;
          cadImpressora.value = d.impressora || '';
          btnSalvarToner.textContent = 'Salvar Alterações';
          btnCancelarToner.style.display = 'inline-block';
          window.scrollTo({top:0, behavior:'smooth'});
        }
      }catch(e){ console.error('Erro ao carregar toner para edição', e); }
    };
  });
}

btnCancelarToner.onclick = ()=>{
  idEmEdicaoToner = null;
  formCadastroToner.reset();
  btnSalvarToner.textContent = 'Cadastrar';
  btnCancelarToner.style.display = 'none';
};

formCadastroToner.addEventListener('submit', async (ev)=>{
  ev.preventDefault();
  const novo = {
    modelo: cadModelo.value.trim(),
    quantidade: parseInt(cadQuantidade.value,10),
    impressora: cadImpressora.value.trim()
  };
  if(!novo.modelo || isNaN(novo.quantidade) || !novo.impressora){ alert('Preencha todos os campos'); return; }
  try{
    if(idEmEdicaoToner){
      await updateDoc(doc(db,'impressoras-toners', idEmEdicaoToner), novo);
      alert('Toner atualizado!');
      idEmEdicaoToner = null;
      formCadastroToner.reset();
      btnSalvarToner.textContent = 'Cadastrar';
      btnCancelarToner.style.display = 'none';
      return;
    }
    await addDoc(colecaoToners, novo);
    alert('Toner cadastrado!');
    formCadastroToner.reset();
  }catch(e){ console.error('Erro ao salvar toner', e); alert('Erro ao salvar toner'); }
});

// filtro em tempo real na consulta de modelos
filtroModeloConsulta.addEventListener('input', ()=>{
  const termo = filtroModeloConsulta.value.trim().toLowerCase();
  document.querySelectorAll('#tabelaConsulta tr').forEach(tr=>{
    tr.style.display = tr.innerText.toLowerCase().includes(termo) ? '' : 'none';
  });
});

// chamar datalists iniciais
popularDatalists();

// Versão melhorada do controle de toners
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, getDocs, where, deleteDoc
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js";

// ----- CONFIGURAÇÃO FIREBASE (USE SUA PRÓPRIA OU MANTENHA ESTA) -----
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

// ----- UI ELEMENTS -----
const tabs = document.querySelectorAll('.tab-btn');
const tabSections = document.querySelectorAll('.tab');
tabs.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    tabs.forEach(b=>b.classList.remove('active'));
    tabSections.forEach(s=>s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.target).classList.add('active');
  });
});

function escapeHtml(str){ return String(str||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

// ----- CONTROLE DE TROCAS -----
const formRegistro = document.getElementById('formRegistro');
const tabelaRegistros = document.querySelector('#tabelaRegistros tbody');
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
const btnExportPDF = document.getElementById('btnExportPDF');

let registros = []; // cache local com os registros exibidos
let idEmEdicao = null;

// popula datalists (escolas e modelos) a partir do Firestore
async function popularDatalists(){
  // escolas: buscar nomes únicos a partir da coleção 'registros'
  const setEscolas = new Set();
  const snapReg = await getDocs(query(collection(db,'registros'), orderBy('escola')));
  snapReg.forEach(s=> setEscolas.add(s.data().escola));
  const dlEscolas = document.getElementById('listaEscolas');
  dlEscolas.innerHTML = '';
  Array.from(setEscolas).sort().forEach(nome=>{
    const opt = document.createElement('option'); opt.value = nome; dlEscolas.appendChild(opt);
  });

  // modelos: buscar modelos únicos da coleção 'toners'
  const setModelos = new Set();
  const snapTon = await getDocs(query(collection(db,'toners'), orderBy('modelo')));
  snapTon.forEach(s=> setModelos.add(s.data().modelo));
  const dlModelos = document.getElementById('listaModelos');
  dlModelos.innerHTML = '';
  Array.from(setModelos).sort().forEach(m=>{
    const opt = document.createElement('option'); opt.value = m; dlModelos.appendChild(opt);
  });
}

// observa 'registros' em tempo real e atualiza tabela
function carregarTrocas(){
  const q = query(collection(db,'registros'), orderBy('data','desc'));
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
        <td>
          <button class="btn-editar" data-id="${docSnap.id}">✏️</button>
          <button class="btn-excluir" data-id="${docSnap.id}">🗑️</button>
        </td>`;
      tabelaRegistros.appendChild(tr);
    });
    aplicarEventosTabela();
    // atualizar datalists também (caso tenham mudado)
    popularDatalists();
  });
}
carregarTrocas();

// aplica eventos de editar/excluir às linhas renderizadas
function aplicarEventosTabela(){
  document.querySelectorAll('.btn-excluir').forEach(btn=>{
    btn.onclick = async ()=>{
      if(confirm('Deseja excluir este registro?')){
        await deleteDoc(doc(db,'registros',btn.dataset.id));
      }
    };
  });
  document.querySelectorAll('.btn-editar').forEach(btn=>{
    btn.onclick = ()=>{
      const reg = registros.find(r=> r.id === btn.dataset.id);
      if(!reg) return;
      idEmEdicao = reg.id;
      escolaInput.value = reg.escola;
      modeloInput.value = reg.modelo;
      quantidadeInput.value = reg.quantidade;
      dataInput.value = reg.data;
      tipoOperacao.value = reg.tipo;
      btnSalvar.textContent = 'Salvar Alterações';
      btnCancelarEdicao.style.display = 'inline-block';
      window.scrollTo({top:0, behavior:'smooth'});
    };
  });
}

// cancelar edição
btnCancelarEdicao.onclick = ()=>{
  idEmEdicao = null;
  formRegistro.reset();
  btnSalvar.textContent = 'Registrar';
  btnCancelarEdicao.style.display = 'none';
};

// submit (novo registro ou edição)
formRegistro.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const nova = {
    escola: escolaInput.value.trim(),
    modelo: modeloInput.value.trim(),
    quantidade: parseInt(quantidadeInput.value,10),
    data: dataInput.value,
    tipo: tipoOperacao.value
  };
  if(!nova.escola || !nova.modelo || !nova.quantidade || !nova.data || !nova.tipo){
    alert('Preencha todos os campos.');
    return;
  }

  // edição
  if(idEmEdicao){
    await updateDoc(doc(db,'registros',idEmEdicao), nova);
    alert('Registro atualizado!');
    idEmEdicao = null;
    formRegistro.reset();
    btnSalvar.textContent = 'Registrar';
    btnCancelarEdicao.style.display = 'none';
    return;
  }

  // recarga: não mexe no estoque
  if(nova.tipo === 'Recarga'){
    await addDoc(collection(db,'registros'), nova);
    alert('Recarga registrada!');
    formRegistro.reset();
    return;
  }

  // troca: checar estoque e atualizar
  const q = query(collection(db,'toners'), where('modelo','==', nova.modelo));
  const qsnap = await getDocs(q);
  if(qsnap.empty){ alert('Modelo não encontrado no estoque!'); return; }
  const tonerDoc = qsnap.docs[0];
  const tonerData = tonerDoc.data();
  const novaQtd = tonerData.quantidade - nova.quantidade;
  if(novaQtd < 0){ alert('Estoque insuficiente!'); return; }
  await updateDoc(doc(db,'toners',tonerDoc.id), { quantidade: novaQtd });
  await addDoc(collection(db,'registros'), nova);
  alert('Troca registrada e estoque atualizado!');
  formRegistro.reset();
});

// ----- FILTRAGEM EM TEMPO REAL -----
filtroEscola.addEventListener('input', ()=> aplicarFiltroTabela());
filtroMes.addEventListener('change', ()=> aplicarFiltroTabela());

function aplicarFiltroTabela(){
  const termo = filtroEscola.value.trim().toLowerCase();
  const mes = filtroMes.value; // AAAA-MM
  document.querySelectorAll('#tabelaRegistros tbody tr').forEach(tr=>{
    const txt = tr.innerText.toLowerCase();
    const dataTxt = tr.children[3].innerText; // coluna data
    const condEscola = termo === '' || txt.includes(termo);
    const condMes = mes === '' || dataTxt.startsWith(mes);
    tr.style.display = (condEscola && condMes) ? '' : 'none';
  });
}

// ----- RELATÓRIOS: abrir impressão e gerar PDF -----
function gerarHtmlRelatorio(lista){
  let html = `<html><head><meta charset="utf-8"><title>Relatório</title>
  <style>body{font-family:Arial;padding:20px} table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#eee}</style>
  </head><body>`;
  html += `<h2>Relatório de Trocas e Recargas</h2>`;
  html += `<p>Emitido em: ${new Date().toLocaleString()}</p>`;
  html += `<table><tr><th>Escola</th><th>Modelo</th><th>Quantidade</th><th>Data</th><th>Tipo</th></tr>`;
  lista.forEach(r=>{
    html += `<tr><td>${escapeHtml(r.escola)}</td><td>${escapeHtml(r.modelo)}</td><td>${r.quantidade}</td><td>${r.data}</td><td>${escapeHtml(r.tipo)}</td></tr>`;
  });
  html += `</table></body></html>`;
  return html;
}

btnImprimirTodos.addEventListener('click', ()=>{
  if(registros.length===0){ alert('Sem registros.'); return; }
  const w = window.open();
  w.document.write(gerarHtmlRelatorio(registros));
  w.document.close();
  w.print();
});

btnImprimirFiltrado.addEventListener('click', ()=>{
  const termo = filtroEscola.value.trim().toLowerCase();
  const mes = filtroMes.value;
  const filtrados = registros.filter(r=>{
    const condEscola = termo === '' || r.escola.toLowerCase().includes(termo);
    const condMes = mes === '' || r.data.startsWith(mes);
    return condEscola && condMes;
  });
  if(filtrados.length===0){ alert('Nenhum registro encontrado.'); return; }
  const w = window.open(); w.document.write(gerarHtmlRelatorio(filtrados)); w.document.close(); w.print();
});

// gerar e baixar PDF via jsPDF + autotable
btnExportPDF.addEventListener('click', async ()=>{
  const termo = filtroEscola.value.trim().toLowerCase();
  const mes = filtroMes.value;
  const filtrados = registros.filter(r=>{
    const condEscola = termo === '' || r.escola.toLowerCase().includes(termo);
    const condMes = mes === '' || r.data.startsWith(mes);
    return condEscola && condMes;
  });
  if(filtrados.length===0){ alert('Nenhum registro para o PDF.'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({orientation:'landscape'});
  doc.setFontSize(14); doc.text('Relatório de Trocas e Recargas', 14, 14);
  doc.setFontSize(10); doc.text('Emitido: ' + new Date().toLocaleString(), 14, 22);
  const body = filtrados.map(r=> [r.escola, r.modelo, String(r.quantidade), r.data, r.tipo]);
  doc.autoTable({
    head: [['Escola','Modelo','Quantidade','Data','Tipo']],
    body,
    startY: 28,
    styles: { fontSize: 9 }
  });
  doc.save('relatorio_trocas.pdf');
});

// ----- CADASTRO DE TONERS -----
const formCadastroToner = document.getElementById('formCadastroToner');
const tabelaToners = document.querySelector('#tabelaToners tbody');
const tabelaConsulta = document.querySelector('#tabelaConsulta tbody');
const cadModelo = document.getElementById('cadModelo');
const cadQuantidade = document.getElementById('cadQuantidade');
const cadImpressora = document.getElementById('cadImpressora');
const filtroModeloConsulta = document.getElementById('filtroModeloConsulta');
const btnSalvarToner = document.getElementById('btnSalvarToner');
const btnCancelarToner = document.getElementById('btnCancelarToner');

let idTonerEdicao = null;

// observa coleção 'toners' e atualiza tabelas
function carregarToners(){
  const q = query(collection(db,'toners'), orderBy('modelo'));
  onSnapshot(q, snap=>{
    tabelaToners.innerHTML = '';
    tabelaConsulta.innerHTML = '';
    snap.forEach(docSnap=>{
      const d = docSnap.data();
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${escapeHtml(d.modelo)}</td><td>${d.quantidade}</td><td>${escapeHtml(d.impressora)}</td>
        <td>
          <button class="btn-editar" data-id="${docSnap.id}">✏️</button>
          <button class="btn-excluir" data-id="${docSnap.id}">🗑️</button>
        </td>`;
      tabelaToners.appendChild(tr);

      const tr2 = document.createElement('tr');
      tr2.innerHTML = `<td>${escapeHtml(d.modelo)}</td><td>${d.quantidade}</td><td>${escapeHtml(d.impressora)}</td>`;
      tabelaConsulta.appendChild(tr2);
    });
    aplicarEventosToners();
    // atualizar datalist de modelos
    popularDatalists();
  });
}
carregarToners();

function aplicarEventosToners(){
  document.querySelectorAll('#tabelaToners .btn-excluir').forEach(btn=>{
    btn.onclick = async ()=>{
      if(confirm('Excluir este toner?')){
        await deleteDoc(doc(db,'toners',btn.dataset.id));
      }
    };
  });
  document.querySelectorAll('#tabelaToners .btn-editar').forEach(btn=>{
    btn.onclick = async ()=>{
      // buscar pelo id diretamente
      const snap = await getDocs(query(collection(db,'toners'), where('__name__','==',btn.dataset.id)));
      if(!snap.empty){
        const d = snap.docs[0].data();
        idTonerEdicao = btn.dataset.id;
        cadModelo.value = d.modelo;
        cadQuantidade.value = d.quantidade;
        cadImpressora.value = d.impressora;
        btnSalvarToner.textContent = 'Salvar Alterações';
        btnCancelarToner.style.display = 'inline-block';
        window.scrollTo({top:0, behavior:'smooth'});
      }
    };
  });
}

btnCancelarToner.onclick = ()=>{
  idTonerEdicao = null;
  formCadastroToner.reset();
  btnSalvarToner.textContent = 'Cadastrar';
  btnCancelarToner.style.display = 'none';
};

formCadastroToner.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const novo = {
    modelo: cadModelo.value.trim(),
    quantidade: parseInt(cadQuantidade.value,10),
    impressora: cadImpressora.value.trim()
  };
  if(!novo.modelo || isNaN(novo.quantidade) || !novo.impressora){ alert('Preencha todos os campos.'); return; }
  if(idTonerEdicao){
    await updateDoc(doc(db,'toners',idTonerEdicao), novo);
    idTonerEdicao = null;
    alert('Toner atualizado!');
    formCadastroToner.reset();
    btnSalvarToner.textContent = 'Cadastrar';
    btnCancelarToner.style.display = 'none';
    return;
  }
  await addDoc(collection(db,'toners'), novo);
  alert('Toner cadastrado!');
  formCadastroToner.reset();
});

// filtro tempo real na consulta de modelos
filtroModeloConsulta.addEventListener('input', ()=>{
  const termo = filtroModeloConsulta.value.trim().toLowerCase();
  document.querySelectorAll('#tabelaConsulta tbody tr').forEach(tr=>{
    tr.style.display = tr.innerText.toLowerCase().includes(termo) ? '' : 'none';
  });
});

// atualizar datalists iniciais
popularDatalists();

// Observação: este arquivo usa Firestore. Se preferir usar armazenamento local (localStorage) para testar rapidamente,
// posso também gerar uma versão sem Firebase. Informe se quiser a versão offline.

// app.js - gerencia ambos os sistemas (impressoras e trocas Toner) usando Firebase compat
// ----- Configurações Firebase -----
// INVENTÁRIO (principal) - use sua config original (substitua as chaves se quiser)
const firebaseConfigMain = {
  apiKey: "AIzaSyBWMeGoDass7ZZKbsN7ogX7ZKxTTApprtg",
  authDomain: "inventario-impressoras-2ecbd.firebaseapp.com",
  projectId: "inventario-impressoras-2ecbd",
  storageBucket: "inventario-impressoras-2ecbd.firebasestorage.app",
  messagingSenderId: "993025022167",
  appId: "1:993025022167:web:94c62eac0cfa96ddc1f892",
  measurementId: "G-459GNX2RGH"
};

// TONER (separado) - config fornecida por você
const firebaseConfigToner = {
  apiKey: "AIzaSyBSAMAhiEbBPCNqNpv-dM64Pa_xclwqc54",
  authDomain: "controletoner.firebaseapp.com",
  projectId: "controletoner",
  storageBucket: "controletoner.firebasestorage.app",
  messagingSenderId: "821741941730",
  appId: "1:821741941730:web:32bd9d82c58deef8a37fbb",
  measurementId: "G-HVQ1MN2HBD"
};

// Inicializa dois apps nomeados usando Firebase compat
const appMain = firebase.initializeApp(firebaseConfigMain, 'main');
const appToner = firebase.initializeApp(firebaseConfigToner, 'toner');

const dbMain = firebase.firestore(appMain);
const dbToner = firebase.firestore(appToner);

// ----------------------
// Função de toast simples
function showMessage(msg, type='success'){
  const div = document.createElement('div');
  div.className = 'toast ' + type;
  div.textContent = msg;
  document.body.appendChild(div);
  setTimeout(()=>div.remove(), 3000);
}

// ----------------------
// Cadastro de impressoras (cadastro-impressoras.html)
const formCadastro = document.getElementById('formCadastro');
const limparForm = document.getElementById('limparForm');
if(formCadastro){
  formCadastro.addEventListener('submit', async e=>{
    e.preventDefault();
    const modelo = document.getElementById('modelo').value.trim();
    const toner = document.getElementById('toner').value.trim();
    const escola = document.getElementById('escola').value.trim();
    const propriedade = document.getElementById('propriedade').value;
    if(!modelo||!toner||!escola){ showMessage('Preencha todos os campos','error'); return; }
    try{
      const q = await dbMain.collection('impressoras').where('escola','==',escola).where('toner','==',toner).get();
      if(!q.empty){ showMessage('Essa escola já possui este toner cadastrado','error'); return; }
      await dbMain.collection('impressoras').add({ modelo, toner, escola, propriedade, dataCadastro: new Date() });
      showMessage('Impressora cadastrada com sucesso');
      formCadastro.reset();
    }catch(err){ console.error(err); showMessage('Erro ao cadastrar','error'); }
  });
  limparForm?.addEventListener('click', ()=>formCadastro.reset());
}

// ----------------------
// Listagem de impressoras (lista-impressoras.html)
async function listarImpressoras(filtroEscola='', filtroToner=''){
  const lista = document.getElementById('lista');
  if(!lista) return;
  lista.innerHTML = '';
  try{
    let q = dbMain.collection('impressoras');
    if(filtroEscola) q = q.where('escola','==',filtroEscola);
    if(filtroToner) q = q.where('toner','==',filtroToner);
    const snap = await q.get();
    if(snap.empty){ lista.innerHTML = '<tr><td colspan="6" class="muted">Nenhuma impressora encontrada.</td></tr>'; return; }
    snap.forEach(docSnap=>{
      const d = docSnap.data();
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${d.modelo||''}</td><td>${d.toner||''}</td><td>${d.escola||''}</td><td>${d.propriedade||''}</td><td>${d.dataCadastro? new Date(d.dataCadastro.seconds*1000).toLocaleString() : ''}</td><td><button class="excluir small" data-id="${docSnap.id}">Excluir</button></td>`;
      lista.appendChild(tr);
    });
    document.querySelectorAll('.excluir').forEach(btn=>btn.addEventListener('click', async ()=>{
      const id = btn.getAttribute('data-id');
      if(confirm('Deseja realmente excluir?')){ await dbMain.collection('impressoras').doc(id).delete(); showMessage('Registro excluído'); listarImpressoras(); }
    }));
  }catch(err){ console.error(err); showMessage('Erro ao carregar lista','error'); }
}

const filtroEscolaInput = document.getElementById('filtroEscola');
const filtroTonerInput = document.getElementById('filtroToner');
[filtroEscolaInput, filtroTonerInput].forEach(el=>el?.addEventListener('input', ()=> listarImpressoras(filtroEscolaInput?.value||'', filtroTonerInput?.value||'')));
window.addEventListener('load', ()=> listarImpressoras());

// ----------------------
// Cadastro de trocas (cadastro-troca.html)
const formToner = document.getElementById('formToner');
const btnLimparToner = document.getElementById('btnLimparToner');
if(formToner){
  // Preenche datalists com dados do banco principal (escolas e toners)
  async function preencherDatalists(){
    try{
      const snap = await dbMain.collection('impressoras').get();
      const escolas = new Set();
      const toners = new Set();
      snap.forEach(s=>{ const d=s.data(); if(d.escola) escolas.add(d.escola); if(d.toner) toners.add(d.toner); });
      const elEscolas = document.getElementById('escolasList');
      const elToners = document.getElementById('tonersList');
      if(elEscolas){ elEscolas.innerHTML = ''; escolas.forEach(e=> elEscolas.appendChild(Object.assign(document.createElement('option'),{value:e}))); }
      if(elToners){ elToners.innerHTML = ''; toners.forEach(t=> elToners.appendChild(Object.assign(document.createElement('option'),{value:t}))); }
    }catch(err){ console.error(err); }
  }
  preencherDatalists();

  formToner.addEventListener('submit', async e=>{
    e.preventDefault();
    const escola = document.getElementById('escolaToner').value.trim();
    const toner = document.getElementById('tonerToner').value.trim();
    const data = document.getElementById('dataToner').value;
    const qtd = parseInt(document.getElementById('quantidadeToner').value) || 1;
    const quem = document.getElementById('quemTrocou').value.trim();
    const obs = document.getElementById('obsToner').value.trim();
    if(!escola || !toner || !data){ showMessage('Preencha escola, toner e data','error'); return; }
    try{
      await dbToner.collection('trocasToner').add({ escola, toner, data, quantidade: qtd, quem, obs, criadoEm: new Date() });
      showMessage('Troca registrada com sucesso');
      formToner.reset();
    }catch(err){ console.error(err); showMessage('Erro ao salvar troca','error'); }
  });
  btnLimparToner?.addEventListener('click', ()=> formToner.reset());
}

// ----------------------
// Relatórios (relatorios.html)
async function carregarRelatorios(){
  const tabela = document.getElementById('tabelaRel');
  if(!tabela) return;
  tabela.innerHTML = '';
  const filtroEscola = document.getElementById('filtroEscolaRel')?.value.toLowerCase() || '';
  const filtroMes = document.getElementById('filtroMesRel')?.value || '';
  try{
    const snap = await dbToner.collection('trocasToner').orderBy('data','desc').get();
    const regs = [];
    snap.forEach(s=> regs.push(Object.assign({id:s.id}, s.data())));
    const filtrados = regs.filter(r=>{
      const escolaOk = !filtroEscola || (r.escola && r.escola.toLowerCase().includes(filtroEscola));
      const mesOk = !filtroMes || (r.data && r.data.startsWith(filtroMes));
      return escolaOk && mesOk;
    });
    if(filtrados.length===0){ tabela.innerHTML = '<tr><td colspan="6" class="muted">Nenhum registro.</td></tr>'; return; }
    filtrados.forEach(r=>{
      const tr=document.createElement('tr');
      tr.innerHTML = `<td>${r.escola||''}</td><td>${r.toner||''}</td><td>${r.quantidade||''}</td><td>${r.data||''}</td><td>${r.quem||''}</td><td>${r.obs||''}</td>`;
      tabela.appendChild(tr);
    });
  }catch(err){ console.error(err); showMessage('Erro ao carregar relatórios','error'); }
}

document.getElementById('btnLimparFiltrosRel')?.addEventListener('click', ()=>{ document.getElementById('filtroEscolaRel').value=''; document.getElementById('filtroMesRel').value=''; carregarRelatorios(); });
document.getElementById('btnExportarPDFRel')?.addEventListener('click', ()=>{
  const tabela = document.getElementById('tabelaRel');
  if(!tabela) return;
  const rows = Array.from(tabela.querySelectorAll('tbody tr')).map(tr=>Array.from(tr.children).map(td=>td.textContent));
  if(rows.length===0){ showMessage('Nada para exportar','error'); return; }
  const { jsPDF } = window.jspdf || {};
  try{
    const doc = new (window.jspdf.jsPDF || window.jspdf)();
  }catch(e){ alert('jsPDF não disponível'); }
});
document.getElementById('btnPrintRel')?.addEventListener('click', ()=>{ window.print(); });
window.addEventListener('load', ()=>{ carregarRelatorios(); });
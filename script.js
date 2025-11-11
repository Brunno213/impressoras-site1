// ========== Firebase Import ==========
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, onSnapshot, query, orderBy,
  doc, updateDoc, getDocs, where, deleteDoc
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js";

// ========== Firebase Config ==========
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

// ========== Utils ==========
const escapeHtml = (str) =>
  String(str || '').replace(/[&<>"']/g, (m) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]
  ));

const setToday = () => {
  document.getElementById('data').value = new Date().toISOString().split("T")[0];
};
setToday();

// ========== Navegação ==========
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.target).classList.add('active');
  });
});

// =============================
//         CONTROLE
// =============================
let registros = [];
let idEmEdicao = null;

const tabelaRegistros = document.querySelector("#tabelaRegistros tbody");
const escola = document.getElementById("escola");
const modelo = document.getElementById("modelo");
const quantidade = document.getElementById("quantidade");
const data = document.getElementById("data");
const tipoOperacao = document.getElementById("tipoOperacao");
const btnSalvar = document.getElementById("btnSalvar");
const btnCancelarEdicao = document.getElementById("btnCancelarEdicao");
const filtroEscola = document.getElementById("filtroEscola");
const filtroMes = document.getElementById("filtroMes");

const colecaoRegistros = collection(db, "impressoras-site1");
const colecaoToners = collection(db, "impressoras-toners");

function carregarTrocas() {
  const q = query(colecaoRegistros, orderBy("data", "desc"));

  onSnapshot(q, snap => {
    registros = [];
    tabelaRegistros.innerHTML = "";

    snap.forEach(docSnap => {
      const r = { id: docSnap.id, ...docSnap.data() };
      registros.push(r);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(r.escola)}</td>
        <td>${escapeHtml(r.modelo)}</td>
        <td>${r.quantidade}</td>
        <td>${r.data}</td>
        <td>${escapeHtml(r.tipo)}</td>
        <td>
          <button class="btn-editar" data-id="${r.id}">✏️</button>
          <button class="btn-excluir" data-id="${r.id}">🗑️</button>
        </td>
      `;
      tabelaRegistros.appendChild(tr);
    });

    aplicarEventos();
    atualizarFiltros();
  });
}
carregarTrocas();

function aplicarEventos() {
  document.querySelectorAll('.btn-excluir').forEach(btn =>
    btn.onclick = async () => {
      if (confirm("Excluir registro?")) {
        await deleteDoc(doc(db, "impressoras-site1", btn.dataset.id));
      }
    }
  );

  document.querySelectorAll('.btn-editar').forEach(btn =>
    btn.onclick = () => {
      const item = registros.find(r => r.id === btn.dataset.id);
      if (!item) return;
      idEmEdicao = item.id;

      escola.value = item.escola;
      modelo.value = item.modelo;
      quantidade.value = item.quantidade;
      data.value = item.data;
      tipoOperacao.value = item.tipo;

      btnSalvar.textContent = "Salvar Alterações";
      btnCancelarEdicao.style.display = "inline-block";
    }
  );
}

btnCancelarEdicao.onclick = () => {
  idEmEdicao = null;
  formRegistro.reset();
  setToday();
  btnSalvar.textContent = "Registrar";
  btnCancelarEdicao.style.display = "none";
};

document.getElementById("formRegistro").addEventListener("submit", async (e) => {
  e.preventDefault();

  const registro = {
    escola: escola.value.trim(),
    modelo: modelo.value.trim(),
    quantidade: Number(quantidade.value),
    data: data.value,
    tipo: tipoOperacao.value
  };

  if (idEmEdicao) {
    await updateDoc(doc(db, "impressoras-site1", idEmEdicao), registro);
    idEmEdicao = null;
    btnSalvar.textContent = "Registrar";
    btnCancelarEdicao.style.display = "none";
    alert("Registro atualizado!");
  } else {
    if (registro.tipo === "Troca") {
      const q = query(colecaoToners, where("modelo", "==", registro.modelo));
      const snap = await getDocs(q);

      if (snap.empty) return alert("Modelo não encontrado no estoque!");

      const tonerDoc = snap.docs[0];
      const estData = tonerDoc.data();
      const novaQtd = estData.quantidade - registro.quantidade;

      if (novaQtd < 0) return alert("Estoque insuficiente!");

      await updateDoc(doc(db, "impressoras-toners", tonerDoc.id), { quantidade: novaQtd });
    }

    await addDoc(colecaoRegistros, registro);
    alert("Registrado!");
  }

  formRegistro.reset();
  setToday();
});

// ========== FILTRO EM TEMPO REAL ==========
function atualizarFiltros() {
  const escolaFiltro = filtroEscola.value.toLowerCase();
  const mesFiltro = filtroMes.value;

  Array.from(tabelaRegistros.children).forEach(tr => {
    const escolaTxt = tr.children[0].innerText.toLowerCase();
    const dataTxt = tr.children[3].innerText;
    tr.style.display =
      (escolaTxt.includes(escolaFiltro) && (!mesFiltro || dataTxt.startsWith(mesFiltro)))
        ? ""
        : "none";
  });
}
filtroEscola.oninput = atualizarFiltros;
filtroMes.onchange = atualizarFiltros;

// =============================
//      ESTOQUE (TONERS)
// =============================
let idTonerEdicao = null;

const tabelaToners = document.querySelector("#tabelaToners tbody");
const tabelaConsulta = document.querySelector("#tabelaConsulta tbody");

function carregarToners() {
  const q = query(colecaoToners, orderBy("modelo"));

  onSnapshot(q, snap => {
    tabelaToners.innerHTML = "";
    tabelaConsulta.innerHTML = "";
    listaModelos.innerHTML = "";

    snap.forEach(docSnap => {
      const d = { id: docSnap.id, ...docSnap.data() };

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(d.modelo)}</td>
        <td>${d.quantidade}</td>
        <td>${escapeHtml(d.impressora)}</td>
        <td>
          <button class="btn-editar-estoque" data-id="${d.id}">✏️</button>
          <button class="btn-excluir-estoque" data-id="${d.id}">🗑️</button>
        </td>`;
      tabelaToners.appendChild(tr);

      const tr2 = document.createElement("tr");
      tr2.innerHTML = `<td>${escapeHtml(d.modelo)}</td><td>${d.quantidade}</td><td>${escapeHtml(d.impressora)}</td>`;
      tabelaConsulta.appendChild(tr2);

      listaModelos.innerHTML += `<option value="${escapeHtml(d.modelo)}"></option>`;
    });

    aplicarEventosToner();
  });
}
carregarToners();

function aplicarEventosToner() {
  document.querySelectorAll('.btn-excluir-estoque').forEach(btn =>
    btn.onclick = async () => {
      if (confirm("Remover toner?"))
        await deleteDoc(doc(db, "impressoras-toners", btn.dataset.id));
    }
  );

  document.querySelectorAll('.btn-editar-estoque').forEach(btn =>
    btn.onclick = () => {
      const toner = [...tabelaToners.children]
        .map(r => r.children)
        .map(c => ({
          modelo: c[0].innerText,
          quantidade: Number(c[1].innerText),
          impressora: c[2].innerText,
        }))[btn.closest("tr").rowIndex];

      idTonerEdicao = btn.dataset.id;
      cadModelo.value = toner.modelo;
      cadQuantidade.value = toner.quantidade;
      cadImpressora.value = toner.impressora;

      btnSalvarToner.textContent = "Salvar alteração";
      btnCancelarToner.style.display = "inline-block";
    }
  );
}

const formCadastroToner = document.getElementById("formCadastroToner");
const btnSalvarToner = document.getElementById("btnSalvarToner");
const btnCancelarToner = document.getElementById("btnCancelarToner");

btnCancelarToner.onclick = () => {
  idTonerEdicao = null;
  formCadastroToner.reset();
  btnSalvarToner.textContent = "Cadastrar";
  btnCancelarToner.style.display = "none";
};

formCadastroToner.addEventListener("submit", async e => {
  e.preventDefault();

  const novo = {
    modelo: cadModelo.value.trim(),
    quantidade: Number(cadQuantidade.value),
    impressora: cadImpressora.value.trim()
  };

  if (novo.quantidade < 0) return alert("Quantidade inválida!");

  if (idTonerEdicao) {
    await updateDoc(doc(db, "impressoras-toners", idTonerEdicao), novo);
    alert("Atualizado!");
    idTonerEdicao = null;
  } else {
    await addDoc(colecaoToners, novo);
    alert("Cadastrado!");
  }

  formCadastroToner.reset();
  btnSalvarToner.textContent = "Cadastrar";
  btnCancelarToner.style.display = "none";
});

// 🔍 FILTRO CONSULTA
document.getElementById("filtroModeloConsulta").oninput = (e) => {
  const filtro = e.target.value.toLowerCase();
  Array.from(tabelaConsulta.children).forEach(tr => {
    const modelo = tr.children[0].innerText.toLowerCase();
    tr.style.display = modelo.includes(filtro) ? "" : "none";
  });
};

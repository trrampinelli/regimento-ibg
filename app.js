
const DEFAULT_FILE = "regimento.json";
const STORAGE_KEY = "regimento_ibg_editor_cache_v_final";
const isEditor = document.body.dataset.mode === "editor";

let state = null;
let selectedChapter = 0;
let editingChapterIndex = null;
let editingItem = null;
let creatingItemType = "article";

const $ = (id) => document.getElementById(id);

function fallbackData(){
  return {
    meta:{title:"Regimento Interno", church:"Igreja Bíblica em Guarapari", version:"1.0", updated:"07.07.2026"},
    chapters:[]
  };
}

async function loadData(){
  if(isEditor){
    const cached = localStorage.getItem(STORAGE_KEY);
    if(cached){
      try { state = JSON.parse(cached); return; } catch(e){}
    }
  }
  try{
    const res = await fetch(DEFAULT_FILE, {cache:"no-store"});
    if(!res.ok) throw new Error("Arquivo JSON não encontrado.");
    state = await res.json();
  }catch(e){
    state = fallbackData();
    showToast("Não foi possível carregar o regimento.json.");
  }
}

function persist(){
  if(isEditor && state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function escapeHTML(value){
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function slugify(value){
  return String(value ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/(^-|-$)/g,"");
}

function articleId(number, chapterIndex, itemIndex){
  return "art-" + slugify(number || `item-${chapterIndex}-${itemIndex}`);
}

function render(){
  if(!state) return;
  persist();

  const query = ($("searchInput")?.value || "").toLowerCase().trim();
  const menu = $("chapterMenu");
  const content = $("content");
  if(!menu || !content) return;

  menu.innerHTML = "";
  state.chapters.forEach((chapter, index)=>{
    const btn = document.createElement("button");
    btn.className = "nav-btn" + (index === selectedChapter ? " active" : "");
    btn.textContent = chapter.title;
    btn.onclick = () => {
      selectedChapter = index;
      closeSidebar();
      render();
      window.scrollTo({top:0, behavior:"smooth"});
    };
    menu.appendChild(btn);
  });

  if(!state.chapters.length){
    content.innerHTML = `<div class="notice-card empty">Nenhum capítulo cadastrado.</div>`;
    return;
  }

  if(selectedChapter >= state.chapters.length) selectedChapter = state.chapters.length - 1;
  const chapter = state.chapters[selectedChapter];

  let html = `
    <section class="meta-card">
      <div>
        <h2>${escapeHTML(state.meta?.title || "Regimento Interno")}</h2>
        <p>${escapeHTML(state.meta?.church || "")}</p>
        <p>Versão ${escapeHTML(state.meta?.version || "")} · Atualização: ${escapeHTML(state.meta?.updated || "")}</p>
      </div>
      ${isEditor ? `<div class="chapter-actions"><button class="btn" onclick="openMetaModal()">Editar dados</button></div>` : ""}
    </section>

    <section class="chapter-card">
      <h2>${escapeHTML(chapter.title)}</h2>
      ${isEditor ? `
      <div class="chapter-actions">
        <button class="btn" onclick="openChapterModal(${selectedChapter})">Alterar nome</button>
        <button class="btn danger" onclick="deleteChapter(${selectedChapter})">Excluir capítulo</button>
      </div>` : ""}
    </section>
  `;

  const filteredItems = (chapter.items || []).filter(item =>
    !query ||
    chapter.title.toLowerCase().includes(query) ||
    (item.number || "").toLowerCase().includes(query) ||
    (item.text || "").toLowerCase().includes(query)
  );

  if(!filteredItems.length){
    html += `<div class="notice-card empty">Nenhum resultado encontrado neste capítulo.</div>`;
  } else {
    filteredItems.forEach((item)=>{
      const realIndex = chapter.items.indexOf(item);
      if(item.type === "section"){
        html += `
          <div class="section-title">
            ${escapeHTML(item.text)}
            ${isEditor ? `<span class="article-actions"><button class="btn light" onclick="openItemModal('section',${selectedChapter},${realIndex})">Editar</button><button class="btn danger" onclick="deleteItem(${selectedChapter},${realIndex})">Excluir</button></span>` : ""}
          </div>
        `;
      } else {
        const id = articleId(item.number, selectedChapter, realIndex);
        html += `
          <article class="article-card" id="${id}">
            <h3><a class="article-number-link" href="#${id}">${escapeHTML(item.number)}</a></h3>
            <p>${escapeHTML(item.text)}</p>
            ${isEditor ? `
            <div class="article-actions">
              <button class="btn light" onclick="openItemModal('article',${selectedChapter},${realIndex})">Editar</button>
              <button class="btn danger" onclick="deleteItem(${selectedChapter},${realIndex})">Excluir</button>
            </div>` : `
            <div class="article-actions">
              <button class="btn light" onclick="copyArticleLink('${id}')">Copiar link</button>
            </div>`}
          </article>
        `;
      }
    });
  }
  content.innerHTML = html;
}

function openSidebar(){
  $("sidebar")?.classList.add("open");
  $("sidebarBackdrop")?.classList.add("open");
  document.body.classList.add("no-scroll");
}
function closeSidebar(){
  $("sidebar")?.classList.remove("open");
  $("sidebarBackdrop")?.classList.remove("open");
  document.body.classList.remove("no-scroll");
}

function showToast(message){
  const toast = $("toast");
  if(!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(()=>toast.classList.remove("show"), 2600);
}

function copyArticleLink(id){
  const url = `${location.origin}${location.pathname}#${id}`;
  navigator.clipboard?.writeText(url);
  showToast("Link do artigo copiado.");
}

function closeModals(){
  document.querySelectorAll(".modal").forEach(m=>m.classList.remove("open"));
  editingChapterIndex = null;
  editingItem = null;
}

function openMetaModal(){
  $("metaTitle").value = state.meta?.title || "";
  $("metaChurch").value = state.meta?.church || "";
  $("metaVersion").value = state.meta?.version || "";
  $("metaUpdated").value = state.meta?.updated || "";
  $("metaModal").classList.add("open");
}

function saveMeta(){
  state.meta = {
    title: $("metaTitle").value.trim(),
    church: $("metaChurch").value.trim(),
    version: $("metaVersion").value.trim(),
    updated: $("metaUpdated").value.trim()
  };
  closeModals();
  render();
  showToast("Dados salvos no editor.");
}

function openChapterModal(index = null){
  editingChapterIndex = index;
  $("chapterModalTitle").textContent = index === null ? "Novo capítulo" : "Alterar capítulo";
  $("chapterTitleInput").value = index === null ? "" : state.chapters[index].title;
  $("chapterModal").classList.add("open");
}

function saveChapter(){
  const title = $("chapterTitleInput").value.trim();
  if(!title) return alert("Digite o nome do capítulo.");
  if(editingChapterIndex === null){
    state.chapters.push({title, items:[]});
    selectedChapter = state.chapters.length - 1;
  } else {
    state.chapters[editingChapterIndex].title = title;
  }
  closeModals();
  render();
  showToast("Capítulo salvo.");
}

function deleteChapter(index){
  if(!confirm("Excluir este capítulo e todos os artigos dele?")) return;
  state.chapters.splice(index,1);
  selectedChapter = Math.max(0, index - 1);
  render();
  showToast("Capítulo excluído.");
}

function fillChapterSelect(selected){
  const select = $("itemChapterSelect");
  select.innerHTML = state.chapters.map((chapter,index)=>
    `<option value="${index}">${escapeHTML(chapter.title)}</option>`
  ).join("");
  select.value = selected;
}

function openItemModal(type = "article", chapterIndex = selectedChapter, itemIndex = null){
  if(!state.chapters.length) return alert("Crie um capítulo primeiro.");
  creatingItemType = type;
  editingItem = itemIndex === null ? null : {chapterIndex, itemIndex};

  fillChapterSelect(chapterIndex);
  const item = itemIndex === null ? {number:"", text:""} : state.chapters[chapterIndex].items[itemIndex];

  $("itemModalTitle").textContent =
    itemIndex === null
      ? (type === "section" ? "Novo subtítulo" : "Novo artigo")
      : (type === "section" ? "Editar subtítulo" : "Editar artigo");

  $("articleNumberWrapper").style.display = type === "section" ? "none" : "block";
  $("itemNumberInput").value = item.number || "";
  $("itemTextInput").value = item.text || "";
  $("itemModal").classList.add("open");
}

function saveItem(){
  const chapterIndex = Number($("itemChapterSelect").value);
  const number = $("itemNumberInput").value.trim();
  const text = $("itemTextInput").value.trim();

  if(!text) return alert("Digite o texto.");
  if(creatingItemType === "article" && !number) return alert("Digite o número do artigo.");

  const item = creatingItemType === "section"
    ? {type:"section", text}
    : {type:"article", number, text};

  if(editingItem){
    state.chapters[editingItem.chapterIndex].items.splice(editingItem.itemIndex, 1);
    state.chapters[chapterIndex].items.push(item);
  } else {
    state.chapters[chapterIndex].items.push(item);
  }

  selectedChapter = chapterIndex;
  closeModals();
  render();
  showToast("Item salvo.");
}

function deleteItem(chapterIndex, itemIndex){
  if(!confirm("Excluir este item?")) return;
  state.chapters[chapterIndex].items.splice(itemIndex,1);
  render();
  showToast("Item excluído.");
}

function downloadJSON(){
  persist();
  const blob = new Blob([JSON.stringify(state,null,2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "regimento.json";
  a.click();
  URL.revokeObjectURL(url);
  showToast("Arquivo regimento.json exportado.");
}

function importJSON(event){
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try{
      const imported = JSON.parse(e.target.result);
      if(!imported.chapters || !Array.isArray(imported.chapters)) throw new Error("Formato inválido.");
      state = imported;
      selectedChapter = 0;
      persist();
      render();
      showToast("JSON importado com sucesso.");
    }catch(err){
      alert("Arquivo JSON inválido.");
    }
  };
  reader.readAsText(file);
}

function clearLocalChanges(){
  if(!confirm("Apagar alterações locais do editor e recarregar do regimento.json?")) return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

document.addEventListener("DOMContentLoaded", async ()=>{
  await loadData();
  render();

  const hash = location.hash.replace("#","");
  if(hash && !isEditor){
    setTimeout(()=>{
      const target = document.getElementById(hash);
      if(target) target.scrollIntoView({behavior:"smooth", block:"start"});
    }, 300);
  }
});

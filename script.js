import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAJA22Ozc0EOHMAlVBr7TBnR6nHuyEHenA",
    authDomain: "memorias-final.firebaseapp.com",
    projectId: "memorias-final",
    storageBucket: "memorias-final.firebasestorage.app",
    messagingSenderId: "723434570784",
    appId: "1:723434570784:web:c2b222195add18e7f72845"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', async function() {
    
    // Entrada Suave
    setTimeout(() => { document.body.classList.remove('page-loading'); }, 100);

    let imagensAtuais = [], indiceFotoAtual = 0, vozSelecionada = null, zoomLevel = 1;
    let isDragging = false, startX = 0, startY = 0, translateX = 0, translateY = 0;
    window.listaDiariosGlobal = []; 

    // --- FUNÇÃO CRÍTICA: DESENHAR A LINHA ---
    function desenharLinha() {
        const svg = document.getElementById('ink-canvas');
        const path = document.getElementById('ink-path');
        const timeline = document.getElementById('timeline');
        const footer = document.querySelector('footer'); 
        const cards = document.querySelectorAll('.timeline-card');
        
        if (!svg || !path || cards.length === 0 || !timeline || !footer) return;

        // 1. DIMENSÕES: Pega a altura total real
        // footer.offsetTop garante que vamos até o final da página
        const totalHeight = (footer.offsetTop + footer.offsetHeight) - timeline.offsetTop;
        const width = timeline.offsetWidth;
        const isMobile = window.innerWidth <= 800;
        
        // Define o centro (no mobile é 22px da esquerda, desktop é meio)
        const centerX = isMobile ? 22 : width / 2;
        
        // Aplica altura no SVG
        svg.style.height = totalHeight + 'px';
        svg.setAttribute('viewBox', `0 0 ${width} ${totalHeight}`);
        
        // 2. CONSTRUIR O CAMINHO (Path)
        // Começa no topo centro
        let d = `M ${centerX} 0`;
        let lastY = 0;

        // Conecta cada card
        cards.forEach((card) => {
            // Posição vertical da bolinha do card
            const dotY = card.offsetTop + 45; 
            
            // Desenha linha curvada (Bezicr) suave até o ponto
            // Control points criam a curva orgânica
            const cp1Y = lastY + (dotY - lastY) * 0.5;
            const cp2Y = lastY + (dotY - lastY) * 0.5;
            
            // Pequeno desvio lateral aleatório para parecer mão humana
            const wobble = (Math.random() - 0.5) * 10; 

            d += ` C ${centerX + wobble} ${cp1Y}, ${centerX - wobble} ${cp2Y}, ${centerX} ${dotY}`;
            
            lastY = dotY;
        });

        // 3. DESENHO DAS RAÍZES (FINAL)
        const footerTextY = totalHeight - 60; // Perto do texto do rodapé
        d += ` L ${centerX} ${footerTextY}`; // Linha reta até o rodapé

        // Raízes se espalhando
        const spread = isMobile ? 40 : 150;
        
        // Raiz central
        d += ` M ${centerX} ${footerTextY} Q ${centerX} ${footerTextY+40} ${centerX} ${footerTextY+80}`;
        // Raízes laterais
        d += ` M ${centerX} ${footerTextY} Q ${centerX-20} ${footerTextY+20} ${centerX-spread} ${footerTextY+60}`;
        d += ` M ${centerX} ${footerTextY} Q ${centerX+20} ${footerTextY+20} ${centerX+spread} ${footerTextY+60}`;

        path.setAttribute('d', d);

        // 4. ANIMAÇÃO DE SCROLL (TINTA DESCENDO)
        const length = path.getTotalLength();
        path.style.strokeDasharray = length;
        path.style.strokeDashoffset = length; // Começa "apagada"

        // Remove listener antigo para não duplicar
        window.removeEventListener('scroll', window.fnScrollAnim);
        
        window.fnScrollAnim = () => {
            const scrollTop = window.scrollY;
            const docHeight = document.body.scrollHeight - window.innerHeight;
            const scrollPercent = scrollTop / docHeight;
            
            // Acelera (1.2x) para a tinta chegar antes do usuário
            const draw = length * (scrollPercent * 1.3); 
            path.style.strokeDashoffset = Math.max(0, length - draw);
        };

        window.addEventListener('scroll', window.fnScrollAnim);
        window.fnScrollAnim(); // Executa 1 vez
    }

    // --- CARREGAR DADOS ---
    const timelineContent = document.getElementById('timeline-content');
    
    try {
        const querySnapshot = await getDocs(collection(db, "diarios"));
        let lista = [];
        querySnapshot.forEach((doc) => lista.push(doc.data()));
        lista.sort((a, b) => new Date(a.data) - new Date(b.data));
        window.listaDiariosGlobal = lista;

        if (timelineContent) {
            timelineContent.innerHTML = "";
            if (lista.length === 0) timelineContent.innerHTML = "<p style='text-align:center; padding:50px'>Acervo vazio.</p>";

            let ultimoAno = null;

            lista.forEach((item, index) => {
                const anoAtual = item.data.split('-')[0];
                if (anoAtual !== ultimoAno) {
                    const divisor = document.createElement('div');
                    divisor.className = 'year-divider timeline-element';
                    divisor.innerHTML = `<span>${anoAtual}</span>`;
                    timelineContent.appendChild(divisor);
                    ultimoAno = anoAtual;
                }

                const article = document.createElement('article');
                article.className = 'timeline-card timeline-element';
                const imgUrl = converterLinkDrive(item.imagem);
                let iconHtml = (item.imagem2) ? `<div class="multi-icon"><span class="material-icons">collections</span></div>` : "";

                article.innerHTML = `
                    <div class="card-header"><span class="card-date">${formatarDataExtenso(item.data)}</span></div>
                    <h2>${item.titulo}</h2>
                    <div class="img-wrapper" onclick="abrirModal(${index})">
                        <img src="${imgUrl}" class="diary-img" loading="lazy" onerror="this.src='https://placehold.co/600?text=Erro'">
                        ${iconHtml}
                        <div class="zoom-hint">CLIQUE PARA ABRIR</div>
                    </div>
                    <p style="font-size: 0.9rem; color: var(--text-light); margin-top: 10px;">Toque na imagem para ver mais.</p>
                `;
                timelineContent.appendChild(article);
            });

            // GATILHO IMPORTANTE:
            // Espera um pouco para garantir que o DOM renderizou
            // E desenha a linha.
            setTimeout(() => {
                desenharLinhaDoTempo();
                ativarObservador();
            }, 800);

            // Redesenha se a janela mudar de tamanho
            window.addEventListener('resize', desenharLinhaDoTempo);
            
            // Redesenha quando todas as imagens terminarem de carregar (garante altura correta)
            window.addEventListener('load', desenharLinhaDoTempo);
        }
    } catch (e) { console.error(e); }

    // --- RESTANTE DAS FUNÇÕES (IGUAIS) ---
    // (Copie aqui as funções: ativarObservador, converterLinkDrive, formatarDataExtenso, 
    // abrirModal, mudarFoto, zoom, voz... do script anterior)
    
    // ... [COLE AQUI O RESTO DO SCRIPT ANTERIOR] ...
    
    function ativarObservador() {
        const elements = document.querySelectorAll('.timeline-element');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); });
        }, { threshold: 0.1 });
        elements.forEach(el => observer.observe(el));
    }

    function converterLinkDrive(link) {
        if (!link) return "";
        link = link.trim();
        if (link.includes('drive.google.com')) {
            let id = link.match(/\/d\/(.+?)(?:\/|$|\?)/)?.[1] || link.match(/id=(.+?)(?:&|$)/)?.[1];
            if (id) return `https://lh3.googleusercontent.com/d/${id}=w1000`;
        }
        return link;
    }
    
    function formatarDataExtenso(d) {
        if (!d) return "";
        const p = d.split('-');
        if(p.length === 3) {
            const m = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
            return `${p[2]} de ${m[parseInt(p[1])-1]} de ${p[0]}`;
        }
        return d;
    }

    // Modal & Zoom
    window.aplicarZoom = function(f) { zoomLevel += f; if (zoomLevel < 1) { zoomLevel = 1; translateX = 0; translateY = 0; } if (zoomLevel > 4) zoomLevel = 4; atualizarTransformacao(); }
    function resetarZoom() { zoomLevel = 1; translateX = 0; translateY = 0; atualizarTransformacao(); }
    function atualizarTransformacao() { const img = document.getElementById('modal-img'); if(img) img.style.transform = `translate(${translateX}px, ${translateY}px) scale(${zoomLevel})`; }
    const imgModal = document.getElementById('modal-img');
    if(imgModal) {
        imgModal.addEventListener('mousedown', (e) => { if(zoomLevel > 1) { isDragging=true; startX=e.clientX-translateX; startY=e.clientY-translateY; imgModal.style.cursor='grabbing'; e.preventDefault(); }});
        window.addEventListener('mouseup', () => { isDragging=false; if(imgModal) imgModal.style.cursor='grab'; });
        window.addEventListener('mousemove', (e) => { if(!isDragging) return; e.preventDefault(); translateX=e.clientX-startX; translateY=e.clientY-startY; atualizarTransformacao(); });
    }

    window.abrirModal = function(i) {
        const item = window.listaDiariosGlobal[i]; if(!item) return;
        imagensAtuais = [];
        if(item.imagem) imagensAtuais.push(converterLinkDrive(item.imagem));
        if(item.imagem2) imagensAtuais.push(converterLinkDrive(item.imagem2));
        indiceFotoAtual = 0; resetarZoom(); atualizarImagemModal();
        document.getElementById('modal-titulo').innerText = item.titulo;
        document.getElementById('modal-data').innerText = formatarDataExtenso(item.data);
        const txt = document.getElementById('modal-content-text'); txt.innerHTML = "";
        if (item.transcricao) txt.innerHTML += `<div class="section-transcricao"><h4>Transcrição</h4><p class="text-handwriting">"${item.transcricao}"</p><button class="narrate-btn" onclick="lerTexto('${escapar(item.transcricao)}')"><span class="material-icons">volume_up</span> Ouvir</button></div>`;
        if (item.descricao) txt.innerHTML += `<div class="section-descricao"><h4>Contexto</h4><p>${item.descricao}</p><button class="narrate-btn" onclick="lerTexto('${escapar(item.descricao)}')"><span class="material-icons">volume_up</span> Ouvir</button></div>`;
        document.getElementById('image-modal').classList.remove('hidden'); document.body.style.overflow = "hidden";
    }
    
    window.mudarFoto = function(d) { let n = indiceFotoAtual + d; if(n >= 0 && n < imagensAtuais.length) { indiceFotoAtual = n; resetarZoom(); atualizarImagemModal(); } }
    function atualizarImagemModal() {
        document.getElementById('modal-img').src = imagensAtuais[indiceFotoAtual];
        const ctr = document.getElementById('photo-counter'); const p = document.getElementById('prev-btn'); const n = document.getElementById('next-btn');
        if(imagensAtuais.length > 1) { ctr.classList.remove('hidden'); ctr.innerText = `${indiceFotoAtual+1} / ${imagensAtuais.length}`; p.classList.toggle('hidden', indiceFotoAtual===0); n.classList.toggle('hidden', indiceFotoAtual===imagensAtuais.length-1); } else { ctr.classList.add('hidden'); p.classList.add('hidden'); n.classList.add('hidden'); }
    }
    window.fecharModal = function(e, f) { if(f || e.target.id === 'image-modal') { document.getElementById('image-modal').classList.add('hidden'); document.body.style.overflow = "auto"; resetarZoom(); window.speechSynthesis.cancel(); } }
    
    function carregarVozes() { let v = window.speechSynthesis.getVoices(); if(v.length===0)return; const p=["Google Português", "Microsoft Francisca", "Luciana"]; for(let n of p){ vozSelecionada=v.find(i=>i.name.includes(n)); if(vozSelecionada)break; } if(!vozSelecionada) vozSelecionada=v.find(i=>i.lang==='pt-BR'); }
    if(speechSynthesis.onvoiceschanged !== undefined) speechSynthesis.onvoiceschanged = carregarVozes; setTimeout(carregarVozes, 500);
    window.lerTexto = function(t) { window.speechSynthesis.cancel(); if(!vozSelecionada) carregarVozes(); const u = new SpeechSynthesisUtterance(t); if(vozSelecionada) u.voice = vozSelecionada; u.lang = "pt-BR"; u.rate = 1.1; window.speechSynthesis.speak(u); }
    function escapar(s) { return s.replace(/'/g, "\\'").replace(/"/g, '"').replace(/\n/g, ' '); }

    const btnC = document.getElementById('btn-contrast'); if(btnC) btnC.addEventListener('click', () => document.body.classList.toggle('high-contrast'));
    let fs = 100;
    const btnP = document.getElementById('btn-font-plus'); if(btnP) btnP.addEventListener('click', () => { if(fs<150) fs+=10; document.body.style.fontSize = fs+'%'; });
    const btnM = document.getElementById('btn-font-minus'); if(btnM) btnM.addEventListener('click', () => { if(fs>70) fs-=10; document.body.style.fontSize = fs+'%'; });
});

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
    
    setTimeout(() => { document.body.classList.remove('page-loading'); }, 100);

    let imagensAtuais = [], indiceFotoAtual = 0, vozSelecionada = null, zoomLevel = 1;
    let isDragging = false, startX = 0, startY = 0, translateX = 0, translateY = 0;
    window.listaDiariosGlobal = []; 

    // --- GERADOR DE LINHA ORGÂNICA (TINTA) ---
    function desenharLinhaTinteiro() {
        const svg = document.getElementById('ink-canvas');
        const path = document.getElementById('ink-path');
        const timeline = document.getElementById('timeline');
        const footer = document.querySelector('footer');
        const cards = document.querySelectorAll('.timeline-card');
        
        if (!svg || !timeline || cards.length === 0) return;

        // Calcula coordenadas
        const footerRect = footer.getBoundingClientRect();
        const timelineRect = timeline.getBoundingClientRect();
        const timelineTop = timeline.offsetTop;
        
        // A linha vai até o fim do footer
        const totalHeight = (footer.offsetTop + footer.offsetHeight) - timelineTop;
        const width = timeline.offsetWidth;
        const isMobile = window.innerWidth <= 800;
        
        // Centro da linha (no meio ou esquerda no mobile)
        const centerX = isMobile ? 22 : width / 2;
        
        svg.style.height = totalHeight + 'px';
        svg.setAttribute('viewBox', `0 0 ${width} ${totalHeight}`);
        
        // COMEÇO DO DESENHO
        let d = `M ${centerX} 0`;
        let currentY = 0;

        // Função para criar linha "tremida" entre dois pontos
        // Simula a mão humana que não faz linha 100% reta
        function drawOrganicLineTo(targetY) {
            let pathString = "";
            const step = 20; // A cada 20px faz um pequeno desvio
            
            while(currentY < targetY) {
                let nextY = currentY + step;
                if(nextY > targetY) nextY = targetY;
                
                // Jitter (Tremor) aleatório
                // No mobile treme menos para caber
                const jitter = (Math.random() - 0.5) * (isMobile ? 1 : 2); 
                const cpX = centerX + jitter;
                
                pathString += ` L ${cpX} ${nextY}`;
                currentY = nextY;
            }
            return pathString;
        }

        // 1. Passar por cada card
        cards.forEach((card) => {
            const cardTop = card.offsetTop;
            const dotY = cardTop + 45; // Alinha com a bolinha
            
            // Desenha linha orgânica até a bolinha
            d += drawOrganicLineTo(dotY);
            
            // Garante ponto exato na bolinha
            d += ` L ${centerX} ${dotY}`;
            currentY = dotY;
        });

        // 2. Ir até o fim do rodapé
        const endY = totalHeight - 20;
        d += drawOrganicLineTo(endY);

        path.setAttribute('d', d);

        // CONFIGURAÇÃO DA ANIMAÇÃO DE SCROLL
        const length = path.getTotalLength();
        path.style.strokeDasharray = length;
        path.style.strokeDashoffset = length; // Começa invisível

        // Remove listener antigo
        if (window.scrollAnim) window.removeEventListener('scroll', window.scrollAnim);

        window.scrollAnim = () => {
            const scrollTop = window.scrollY;
            const windowHeight = window.innerHeight;
            const docHeight = document.body.scrollHeight;
            
            // Calcula porcentagem do scroll
            // Usamos um fator para que a linha termine de desenhar quando o footer aparecer
            const scrollPercent = (scrollTop + windowHeight * 0.5) / (docHeight);
            
            // Acelera um pouco (1.3x) para a tinta estar sempre "chegando" onde o olho vê
            const draw = length * (scrollPercent * 1.5);
            
            path.style.strokeDashoffset = Math.max(0, length - draw);
        };

        window.addEventListener('scroll', window.scrollAnim);
        window.scrollAnim(); // Executa uma vez
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

            // Delay para garantir renderização correta das posições
            setTimeout(() => {
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); });
                }, { threshold: 0.1 });
                document.querySelectorAll('.timeline-element').forEach(c => observer.observe(c));
                
                // Desenha a linha
                desenharLinhaTinteiro();
                
                // Redesenha se mudar tamanho da tela (Ex: virar celular)
                window.addEventListener('resize', desenharLinhaTinteiro);
                
                // Redesenha periodicamente por alguns segundos para garantir carregamento de fontes/imagens
                setTimeout(desenharLinhaTinteiro, 1000);
                setTimeout(desenharLinhaTinteiro, 3000);
                
            }, 500); 
        }
    } catch (e) { console.error(e); }

    // --- FUNÇÕES UTILITÁRIAS (Mantidas) ---
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

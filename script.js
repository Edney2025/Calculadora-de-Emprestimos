document.addEventListener('DOMContentLoaded', () => {
    // ========================================================
    // JavaScript Simulador de Empréstimo PRO (V13 - Final)
    // ========================================================

    let CONFIG = {
        credorNome: 'Edney Cunha da Silva',
        credorCpfCnpj: '065.932.739-29',
        credorContatoTel: '(44) 9 9840-8460',
        credorContatoEmail: 'encomendapalotina@gmail.com',
        contratoCidade: 'Palotina',
        contratoEstado: 'PR',
        taxaMensalParcelado_3x: 0.17, // 17%
        taxaMensalParcelado_48x: 0.10, // 10%
        taxaDiarioPrimeiroDia: 0.35, // 35%
        taxaDiarioUltimoDia: 1.00, // 100%
        adminCodigoAcesso: '68366836'
    };

    let estado = {
        etapaAtual: 1,
        faixaPreco: { selecionada: false, valorPredefinido: 0, limiteMaximo: 0 },
        dadosCalculadora: { nomeCompletoCliente: '', cpfCliente: '', valorSolicitado: 0 },
        resultados: { parcelado: [], diario: [], opcaoSelecionada: null },
    };

    const getElem = id => document.getElementById(id);
    const formatarMoeda = valor => (Number(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const formatarData = data => data instanceof Date && !isNaN(data) ? data.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '--/--/----';
    const addDays = (date, days) => { const d = new Date(date); d.setUTCDate(d.getUTCDate() + days); return d; };

    function mostrarEtapa(numEtapa) {
        if (numEtapa > estado.etapaAtual) {
            if (estado.etapaAtual === 1 && !estado.faixaPreco.selecionada) return;
            if (estado.etapaAtual === 2 && !validarEtapa2()) return;
            if (estado.etapaAtual === 3 && !estado.resultados.opcaoSelecionada) return;
        }
        estado.etapaAtual = numEtapa;
        document.querySelectorAll('.etapa').forEach((e, i) => e.classList.toggle('ativa', i + 1 === numEtapa));
        
        atualizarRodape();
        
        const handlers = [null, configurarEtapa2, configurarEtapa3, configurarEtapa4];
        if (handlers[numEtapa-1]) handlers[numEtapa-1]();
    }
    
    function atualizarRodape() {
        const btnVoltar = getElem('btn-voltar');
        const btnAvancar = getElem('btn-avancar');
        const etapaIndicator = getElem('etapa-indicator');
        
        btnVoltar.style.visibility = estado.etapaAtual > 1 ? 'visible' : 'hidden';
        etapaIndicator.textContent = `ETAPA ${estado.etapaAtual} DE 4`;
        
        const labels = ["Avançar para Dados", "Ver Opções de Pagamento", "Gerar Resumo e Contrato", ""];
        
        if (estado.etapaAtual >= 4) {
            btnAvancar.style.display = 'none';
        } else {
            btnAvancar.style.display = 'inline-flex';
            btnAvancar.textContent = `${labels[estado.etapaAtual]} →`;
        }

        let isAvancarDisabled = true;
        if(estado.etapaAtual === 1) isAvancarDisabled = !estado.faixaPreco.selecionada;
        else if(estado.etapaAtual === 2) isAvancarDisabled = !validarEtapa2();
        else if(estado.etapaAtual === 3) isAvancarDisabled = !estado.resultados.opcaoSelecionada;
        btnAvancar.disabled = isAvancarDisabled;
    }
    
    function configurarEtapa2() {
        Object.assign(estado.dadosCalculadora, JSON.parse(localStorage.getItem('cliente') || '{}'));
        getElem('nome-completo-cliente').value = estado.dadosCalculadora.nomeCompletoCliente || '';
        getElem('cpf-cliente').value = estado.dadosCalculadora.cpfCliente || '';
        getElem('limite-valor-info').textContent = `(Até ${formatarMoeda(estado.faixaPreco.limiteMaximo)})`;
        atualizarValorCalculadora(Number(estado.faixaPreco.valorPredefinido) || 0);
    }

    const atualizarValorCalculadora = valor => {
        const valorValidado = Math.max(0, Math.min(valor, estado.faixaPreco.limiteMaximo));
        getElem('valor-display').textContent = formatarMoeda(valorValidado);
        estado.dadosCalculadora.valorSolicitado = valorValidado;
        validarEtapa2();
    };
    
    function validarEtapa2() {
        const { nomeCompletoCliente, cpfCliente, valorSolicitado } = estado.dadosCalculadora;
        const isValid = nomeCompletoCliente.trim().split(' ').length >= 2 && 
                      /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(cpfCliente) &&
                      valorSolicitado > 0;
        atualizarRodape();
        return isValid;
    }

    function configurarEtapa3() {
        estado.resultados.opcaoSelecionada = null;
        atualizarRodape();
        calcularParcelado();
        calcularDiario();
    }
    
    function calcularParcelado() {
        const container = getElem('container-parcelado');
        const { valorSolicitado } = estado.dadosCalculadora;
        estado.resultados.parcelado = [];
        let html = '';
        for (let p = 3; p <= 48; p += 3) {
            const fator = (p - 3) / 45; 
            const taxa = CONFIG.taxaMensalParcelado_3x - fator * (CONFIG.taxaMensalParcelado_3x - CONFIG.taxaMensalParcelado_48x);
            const parcela = valorSolicitado * (taxa * Math.pow(1 + taxa, p)) / (Math.pow(1 + taxa, p) - 1);
            const valorFinal = Math.ceil(parcela * 20) / 20;
            const opId = `op-parc-${p}`;
            estado.resultados.parcelado.push({ id: opId, tipo: 'parcelado', parcelas: p, valorParcela: valorFinal });
            html += `<div class="opcao-resultado" data-id="${opId}"><span class="titulo">${p}x ${formatarMoeda(valorFinal)}</span></div>`;
        }
        container.innerHTML = html;
    }

    function calcularDiario() {
        const container = getElem('container-diario');
        const hoje = new Date();
        const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
        
        estado.resultados.diario = [];
        let html = '';
        for (let d = 1; d <= diasNoMes; d++) {
            const taxa = CONFIG.taxaDiarioPrimeiroDia + ((d - 1) / (diasNoMes - 1)) * (CONFIG.taxaDiarioUltimoDia - CONFIG.taxaDiarioPrimeiroDia);
            const valorDia = estado.dadosCalculadora.valorSolicitado * (1 + taxa);
            const dataDia = addDays(hoje, d - 1);
            const opId = `op-diario-${d}`;
            estado.resultados.diario.push({ id: opId, tipo: 'diario', dia: d, valor: valorDia, data: dataDia });
            html += `<div class="opcao-resultado diario-card" data-id="${opId}">
                        <div class="titulo">${d}º Dia para Pagar</div>
                        <div class="data">${formatarData(dataDia)}</div>
                        <div class="valor">${formatarMoeda(valorDia)}</div>
                    </div>`;
        }
        container.innerHTML = html;
    }
    
    function selecionarOpcaoPagamento(id) {
        const opcao = estado.resultados.parcelado.find(op => op.id === id) || estado.resultados.diario.find(op => op.id === id);
        estado.resultados.opcaoSelecionada = opcao;
        
        document.querySelectorAll('.opcao-resultado.selected').forEach(el => el.classList.remove('selected'));
        const elemSelecionado = document.querySelector(`[data-id="${id}"]`);
        if(elemSelecionado) elemSelecionado.classList.add('selected');
        
        atualizarRodape();
    }
    
    function configurarEtapa4() {
        const op = estado.resultados.opcaoSelecionada;
        const d = estado.dadosCalculadora;
        if (!op) return;
        let html = `<h4>📄 Resumo da Proposta</h4>`;
        html += `<p><span class="icon">👤</span><strong>Nome:</strong> ${d.nomeCompletoCliente}</p>`;
        html += `<p><span class="icon">🆔</span><strong>CPF:</strong> ${d.cpfCliente}</p>`;
        html += `<p><span class="icon">💰</span><strong>Valor Solicitado:</strong> ${formatarMoeda(d.valorSolicitado)}</p><hr>`;
        if (op.tipo === 'parcelado') {
            html += `<p><span class="icon">💳</span><strong>Condições:</strong> ${op.parcelas} parcelas de ${formatarMoeda(op.valorParcela)}</p>`;
        } else {
            html += `<p><span class="icon">🗓️</span><strong>Condições:</strong> Quitar ${formatarMoeda(op.valor)} no ${op.dia}º dia</p>`;
        }
        getElem('resumo-container').innerHTML = html;
        atualizarRodape();
    }

    // --- Inicialização ---
    (function init() {
        const setTheme = theme => document.body.className = `theme-${theme}`;
        setTheme(localStorage.getItem('calcTheme') || 'dark');
        
        getElem('btn-voltar').addEventListener('click', () => mostrarEtapa(estado.etapaAtual - 1));
        getElem('btn-avancar').addEventListener('click', () => mostrarEtapa(estado.etapaAtual + 1));
        
        getElem('form-faixa-preco').addEventListener('change', e => {
            if(e.target.type === 'radio'){
                estado.faixaPreco = { selecionada: true, valorPredefinido: e.target.value, limiteMaximo: parseFloat(e.target.dataset.limite) };
                atualizarRodape();
            }
        });
        
        ['nome-completo-cliente', 'cpf-cliente'].forEach(id => {
            const elem = getElem(id);
            elem.addEventListener('input', () => {
                if (id === 'cpf-cliente') { elem.value = elem.value.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').slice(0, 14); }
                estado.dadosCalculadora[id.includes('nome') ? 'nomeCompletoCliente' : 'cpfCliente'] = elem.value;
                validarEtapa2();
            });
            elem.addEventListener('blur', () => localStorage.setItem('cliente', JSON.stringify({nomeCompletoCliente: estado.dadosCalculadora.nomeCompletoCliente, cpfCliente: estado.dadosCalculadora.cpfCliente})));
        });

        getElem('valor-display').addEventListener('click', () => { const v = prompt("Digite o valor:", estado.dadosCalculadora.valorSolicitado); if (v !== null) atualizarValorCalculadora(parseFloat(v.replace(/[^0-9,-]/g, '').replace(',', '.')) || 0); });
        
        document.querySelector('.preset-buttons').addEventListener('click', e => {
            const btn = e.target.closest('.btn-preset');
            if(!btn) return;
            if (btn.dataset.action === 'add') atualizarValorCalculadora(estado.dadosCalculadora.valorSolicitado + parseFloat(btn.dataset.value));
            else if (btn.dataset.action === 'multiply') atualizarValorCalculadora(estado.dadosCalculadora.valorSolicitado * 2);
            else if (btn.dataset.action === 'clear') atualizarValorCalculadora(0);
        });

        getElem('container-parcelado').addEventListener('click', e => {
            const opcaoElemento = e.target.closest('.opcao-resultado');
            if(opcaoElemento) selecionarOpcaoPagamento(opcaoElemento.dataset.id);
        });
        getElem('container-diario').addEventListener('click', e => {
            const opcaoElemento = e.target.closest('.opcao-resultado');
            if(opcaoElemento) selecionarOpcaoPagamento(opcaoElemento.dataset.id);
        });
        
        getElem('theme-toggle').addEventListener('click', () => {
            const novoTema = document.body.classList.contains('theme-dark') ? 'light' : 'dark';
            setTheme(novoTema);
            localStorage.setItem('calcTheme', novoTema);
        });
        
        mostrarEtapa(1);
    })();
});
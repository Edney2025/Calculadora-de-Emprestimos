document.addEventListener('DOMContentLoaded', () => {
    // ======================================================
    // JavaScript Simulador de Empréstimo PRO (V9.1 - Correção Final de Interação)
    // ======================================================

    let CONFIG = {
        credorNome: 'Edney Cunha da Silva',
        credorCpfCnpj: '065.932.739-29',
        credorContatoTel: '(44) 9 9840-8460',
        credorContatoEmail: 'encomendapalotina@gmail.com',
        contratoCidade: 'Palotina',
        contratoEstado: 'PR',
        taxaMensalParcelado_3x: 0.08,
        taxaMensalParcelado_48x: 0.15,
        taxaDiarioCiclo1: { inicio: 0.35, fim: 1.00 },
        taxaDiarioCiclo2: { inicio: 1.01, fim: 2.00 },
        limiteValorDiario: 500,
        numeroWhatsapp: '5544998408460',
        adminCodigoAcesso: '68366836'
    };

    let estado = {
        etapaAtual: 1,
        faixaPreco: { selecionada: false, valorPredefinido: 0, limiteMaximo: 0 },
        dadosCalculadora: { nomeCompletoCliente: '', cpfCliente: '', valorSolicitado: 0, diaPagamento: null, dataPrimeiroVencimento: null },
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
            if (estado.etapaAtual === 4 && !estado.resultados.opcaoSelecionada) return;
        }
        estado.etapaAtual = numEtapa;
        document.querySelectorAll('.etapa').forEach((e, i) => e.classList.toggle('ativa', i + 1 === numEtapa));
        document.querySelectorAll('.progress-step').forEach((s, i) => {
            s.classList.toggle('active', i + 1 === numEtapa);
            s.classList.toggle('completed', i < numEtapa - 1);
            if (i > 0) document.querySelectorAll('.progress-line')[i - 1].classList.toggle('active', i < numEtapa);
        });
        const etapaAtiva = getElem(`etapa${numEtapa}`);
        if(etapaAtiva) etapaAtiva.scrollTop = 0;
        const handlers = [configurarEtapa1, configurarEtapa2, configurarEtapa3, configurarEtapa4, configurarEtapa5];
        if (handlers[numEtapa-1]) handlers[numEtapa-1]();
    }
    
    function setupAdminPanel() {
        const adminInputsMap = {
            credorNome: 'admin_credor_nome', credorCpfCnpj: 'admin_credor_cpf_cnpj',
            credorContatoTel: 'admin_credor_contato_tel', credorContatoEmail: 'admin_credor_contato_email',
            contratoCidade: 'admin_contrato_cidade', contratoEstado: 'admin_contrato_estado',
            limiteValorDiario: 'admin_limite_valor_diario', taxaMensalParcelado_3x: 'admin_taxa_parcelado_3x',
            taxaMensalParcelado_48x: 'admin_taxa_parcelado_48x'
        };
        const promptAdminPassword = () => { getElem('admin-password-overlay').classList.remove('hidden'); getElem('admin-password-input').focus(); }
        const closeAdminPasswordPrompt = () => { getElem('admin-password-overlay').classList.add('hidden'); }
        const toggleAdminSettings = (forceOpen) => {
            getElem('admin-settings').classList.toggle('hidden', !forceOpen);
            if (forceOpen) loadAdminSettingsToForm();
        }
        const checkAdminPassword = () => {
            if (getElem('admin-password-input').value === CONFIG.adminCodigoAcesso) { closeAdminPasswordPrompt(); toggleAdminSettings(true); } 
            else { getElem('admin-password-error').textContent = 'Senha incorreta.'; }
        }
        const loadAdminSettingsToForm = () => {
            for(const key in adminInputsMap) {
                const elem = getElem(adminInputsMap[key]);
                if(elem) elem.value = key.startsWith('taxa') ? (CONFIG[key] * 100).toFixed(2) : CONFIG[key];
            }
            getElem('admin_taxa_diario1_ini').value = (CONFIG.taxaDiarioCiclo1.inicio * 100).toFixed(2);
            getElem('admin_taxa_diario1_fim').value = (CONFIG.taxaDiarioCiclo1.fim * 100).toFixed(2);
            getElem('admin_taxa_diario2_ini').value = (CONFIG.taxaDiarioCiclo2.inicio * 100).toFixed(2);
            getElem('admin_taxa_diario2_fim').value = (CONFIG.taxaDiarioCiclo2.fim * 100).toFixed(2);
        }
        const saveAdminSettings = () => {
            for(const key in adminInputsMap) {
                const elem = getElem(adminInputsMap[key]);
                const value = elem.value;
                CONFIG[key] = elem.type === 'number' && key.startsWith('taxa') ? parseFloat(value) / 100 : (elem.type === 'number' ? parseFloat(value) : value.trim());
            }
            CONFIG.taxaDiarioCiclo1.inicio = parseFloat(getElem('admin_taxa_diario1_ini').value) / 100;
            CONFIG.taxaDiarioCiclo1.fim = parseFloat(getElem('admin_taxa_diario1_fim').value) / 100;
            CONFIG.taxaDiarioCiclo2.inicio = parseFloat(getElem('admin_taxa_diario2_ini').value) / 100;
            CONFIG.taxaDiarioCiclo2.fim = parseFloat(getElem('admin_taxa_diario2_fim').value) / 100;
            localStorage.setItem('calculadoraConfigAdmin', JSON.stringify(CONFIG));
            alert('Configurações salvas!');
            toggleAdminSettings(false);
        }
        getElem('admin-open-password-prompt-btn').addEventListener('click', promptAdminPassword);
        getElem('admin-login-btn').addEventListener('click', checkAdminPassword);
        getElem('admin-cancel-btn').addEventListener('click', closeAdminPasswordPrompt);
        getElem('admin-close-panel-btn').addEventListener('click', () => toggleAdminSettings(false));
        getElem('admin-save-settings-btn').addEventListener('click', saveAdminSettings);
        getElem('admin-cancel-settings-btn').addEventListener('click', () => toggleAdminSettings(false));
    }
    
    function configurarEtapa1() { getElem('btn-ir-para-etapa2').disabled = !estado.faixaPreco.selecionada; }
    
    function configurarEtapa2() {
        Object.assign(estado.dadosCalculadora, JSON.parse(localStorage.getItem('cliente') || '{}'));
        getElem('nome-completo-cliente').value = estado.dadosCalculadora.nomeCompletoCliente || '';
        getElem('cpf-cliente').value = estado.dadosCalculadora.cpfCliente || '';
        getElem('limite-valor-info').textContent = `(Limite: ${formatarMoeda(estado.faixaPreco.limiteMaximo)})`;
        const valorInicial = estado.dadosCalculadora.valorSolicitado > 0 ? estado.dadosCalculadora.valorSolicitado : (Number(estado.faixaPreco.valorPredefinido) || 0);
        atualizarValorCalculadora(valorInicial);
        validarEtapa2();
    }
    const atualizarValorCalculadora = valor => {
        const valorValidado = Math.max(0, Math.min(valor, estado.faixaPreco.limiteMaximo));
        getElem('valor-validation').textContent = valorValidado < valor ? `Valor ajustado para o limite.` : '';
        estado.dadosCalculadora.valorSolicitado = valorValidado;
        getElem('valor-display').textContent = formatarMoeda(valorValidado);
        validarEtapa2();
    };

    function selecionarDiaPagamento(button) {
        estado.dadosCalculadora.diaPagamento = parseInt(button.dataset.dia, 10);
        document.querySelectorAll('#etapa2 .btn-dia.active').forEach(b => b.classList.remove('active'));
        button.classList.add('active');
        const hoje = new Date(); hoje.setUTCHours(0,0,0,0);
        let vencimento = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), estado.dadosCalculadora.diaPagamento));
        if (vencimento <= hoje) vencimento.setUTCMonth(vencimento.getUTCMonth() + 1);
        estado.dadosCalculadora.dataPrimeiroVencimento = vencimento;
        getElem('info-vencimento').textContent = `1º Vencimento: ${formatarData(vencimento)}`;
        getElem('info-vencimento').style.display = 'block';
        validarEtapa2();
    }

    function validarEtapa2() {
        const { nomeCompletoCliente, cpfCliente, valorSolicitado, diaPagamento } = estado.dadosCalculadora;
        const msgs = [];
        if (nomeCompletoCliente.trim().split(' ').length < 2) msgs.push('Nome');
        if (!/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(cpfCliente)) msgs.push('CPF');
        if (valorSolicitado <= 0) msgs.push('Valor');
        if (!diaPagamento) msgs.push('Dia');
        const isValid = msgs.length === 0;
        getElem('btn-ir-para-etapa3').disabled = !isValid;
        getElem('etapa2-validation').textContent = isValid ? '' : `Preencha: ${msgs.join(', ')}`;
        return isValid;
    }

    function configurarEtapa3() {
        estado.resultados.opcaoSelecionada = null;
        getElem('btn-ir-para-etapa4').disabled = true;
        const defaultTab = estado.dadosCalculadora.valorSolicitado <= CONFIG.limiteValorDiario ? 'diario' : 'parcelado';
        mostrarAbaPagamento(defaultTab);
    }
    function mostrarAbaPagamento(tipo) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.target.includes(tipo)));
        document.querySelectorAll('.resultado-area').forEach(a => a.classList.toggle('active', a.id.includes(tipo)));
        const valor = estado.dadosCalculadora.valorSolicitado;
        const isDailyAvailable = valor > 0 && valor <= CONFIG.limiteValorDiario;
        getElem('daily-limit-warning').style.display = (tipo === 'diario' && !isDailyAvailable) ? 'block' : 'none';
        getElem('daily-limit-warning').innerHTML = `⚠️ Opção diária disponível até <b>${formatarMoeda(CONFIG.limiteValorDiario)}</b>.`;
        if (tipo === 'parcelado') calcularParcelado();
        else if (tipo === 'diario' && isDailyAvailable) calcularDiario();
    }
    
    function calcularParcelado() {
        const container = getElem('container-parcelado');
        const { valorSolicitado, dataPrimeiroVencimento } = estado.dadosCalculadora;
        estado.resultados.parcelado = [];
        let html = '';
        const taxaMenorPrazo = CONFIG.taxaMensalParcelado_3x;
        const taxaMaiorPrazo = CONFIG.taxaMensalParcelado_48x;

        for (let p = 3; p <= 48; p += 3) {
            const fator = (p - 3) / (48 - 3); 
            const taxa = taxaMenorPrazo + fator * (taxaMaiorPrazo - taxaMenorPrazo);
            
            const parcela = valorSolicitado * (taxa * Math.pow(1 + taxa, p)) / (Math.pow(1 + taxa, p) - 1);
            const valorFinal = Math.ceil(parcela * 20) / 20;
            const opId = `op-parc-${p}`;
            estado.resultados.parcelado.push({ id: opId, tipo: 'parcelado', parcelas: p, valorParcela: valorFinal, dataPrimeiroVencimento });
            html += `<div class="opcao-resultado" data-id="${opId}"><span class="titulo">${p}x ${formatarMoeda(valorFinal)}</span></div>`;
        }
        container.innerHTML = `<div class="opcoes-container">${html}</div>`;
    }

    function calcularDiario() {
        const container = getElem('container-diario-table');
        const { valorSolicitado, dataPrimeiroVencimento } = estado.dadosCalculadora;
        const { taxaDiarioCiclo1: t1, taxaDiarioCiclo2: t2 } = CONFIG;
        estado.resultados.diario = [];
        let tableHtml = '<table><thead><tr><th>Dia</th><th>Data</th><th>Valor Quitação</th></tr></thead><tbody>';
        for (let d = 1; d <= 60; d++) {
            const taxa = d <= 30 ? t1.inicio + (d - 1) / 29 * (t1.fim - t1.inicio) : t2.inicio + (d - 31) / 29 * (t2.fim - t2.inicio);
            const valorDia = valorSolicitado * (1 + taxa);
            const dataDia = addDays(dataPrimeiroVencimento, d - 1);
            estado.resultados.diario.push({ id: `op-diario-${d}`, tipo: 'diario', dia: d, valor: valorDia, data: dataDia });
            tableHtml += `<tr data-id="op-diario-${d}" class="${d > 30 ? 'prazo-extendido' : ''}" style="${d > 30 ? 'display: none;' : ''}"><td>${d}</td><td>${formatarData(dataDia)}</td><td>${formatarMoeda(valorDia)}</td></tr>`;
        }
        container.innerHTML = tableHtml + '</tbody></table>';
    }
    
    function selecionarOpcaoPagamento(id) {
        const opcao = estado.resultados.parcelado.find(op => op.id === id) || estado.resultados.diario.find(op => op.id === id);
        estado.resultados.opcaoSelecionada = opcao;
        getElem('btn-ir-para-etapa4').disabled = !opcao;
        const container = getElem(opcao.tipo === 'parcelado' ? 'container-parcelado' : 'container-diario-table');
        container.querySelectorAll('.selected, .dimmed').forEach(el => el.classList.remove('selected', 'dimmed'));
        const allOptions = container.querySelectorAll(opcao.tipo === 'parcelado' ? '.opcao-resultado' : 'tr');
        allOptions.forEach(el => el.classList.add('dimmed'));
        const elemSelecionado = container.querySelector(`[data-id="${id}"]`);
        elemSelecionado.classList.remove('dimmed');
        elemSelecionado.classList.add('selected');
    }
    
    function configurarEtapa4() {
        const op = estado.resultados.opcaoSelecionada;
        if (!op) return;
        let html = `<p><strong>Valor Solicitado:</strong> ${formatarMoeda(estado.dadosCalculadora.valorSolicitado)}</p>`;
        html += `<p><strong>Forma de Pagamento:</strong> ${op.tipo === 'parcelado' ? `${op.parcelas} parcelas de ${formatarMoeda(op.valorParcela)}` : `Quitação Diária`}</p>`;
        html += `<p><strong>${op.tipo === 'parcelado' ? '1º Vencimento:' : 'Data Escolhida:'}</strong> ${op.tipo === 'parcelado' ? formatarData(op.dataPrimeiroVencimento) : `${op.dia}º dia - ${formatarData(op.data)} (${formatarMoeda(op.valor)})`}</p>`;
        getElem('resumo-container').innerHTML = html;
    }
    
    function configurarEtapa5() {
        const op = estado.resultados.opcaoSelecionada;
        if (!op) return;
        let template = getElem('contrato-template').innerHTML;
        const valorSolicitado = estado.dadosCalculadora.valorSolicitado;
        const multa = valorSolicitado * 0.20, juros = valorSolicitado * 0.10;
        const exemploAtraso = `Se um pagamento de ${formatarMoeda(valorSolicitado)} atrasar 30 dias, o valor corrigido será de aprox. ${formatarMoeda(valorSolicitado + multa + juros)} (Multa de ${formatarMoeda(multa)} + Juros de ${formatarMoeda(juros)}).`;
        const placeholders = {
            '[NOME_COMPLETO_DO_CREDOR]': CONFIG.credorNome, '[CPF_CNPJ_DO_CREDOR]': CONFIG.credorCpfCnpj,
            '[TELEFONE_DO_CREDOR]': CONFIG.credorContatoTel, '[EMAIL_DO_CREDOR]': CONFIG.credorContatoEmail,
            '[CIDADE_CONTRATO]': CONFIG.contratoCidade, '[ESTADO_CONTRATO]': CONFIG.contratoEstado,
            '[NOME_CLIENTE_COMPLETO]': estado.dadosCalculadora.nomeCompletoCliente, '[CPF_CLIENTE]': estado.dadosCalculadora.cpfCliente,
            '[DATA_ORCAMENTO_FORMATADA]': formatarData(new Date()),
            '[VALOR_SOLICITADO_FORMATADO]': formatarMoeda(valorSolicitado), '[TIPO_PAGAMENTO]': op.tipo === 'parcelado' ? 'Mensal (Parcelado)' : 'Diário (Quitação)',
            '[NUMERO_PARCELAS]': op.parcelas, '[VALOR_PARCELA_FORMATADO]': formatarMoeda(op.valorParcela),
            '[DATA_PRIMEIRO_VENCIMENTO_PARCELADO]': formatarData(op.dataPrimeiroVencimento),
            '[NUMERO_DIAS_DIARIO]': op.dia, '[VALOR_TOTAL_PAGAMENTO_DIARIO]': formatarMoeda(op.valor),
            '[DATA_ULTIMO_PAGAMENTO_DIARIO]': formatarData(op.data), '[EXEMPLO_ATRASO]': exemploAtraso,
        };
        for(const p in placeholders) template = template.replaceAll(p, placeholders[p] || '');
        getElem('contrato-texto').innerHTML = template;
        getElem('contrato-texto').querySelector('#contrato-parcelado-detalhe').style.display = op.tipo === 'parcelado' ? 'block' : 'none';
        getElem('contrato-texto').querySelector('#contrato-diario-detalhe').style.display = op.tipo === 'diario' ? 'block' : 'none';
        getElem('contrato-texto').querySelector('#clausula-nota-promissoria').style.display = op.tipo === 'parcelado' ? 'block' : 'none';
        getElem('aceito-contrato').checked = false;
        getElem('btn-finalizar-whatsapp').disabled = true;
    }
    
    function finalizarWhatsApp() {
        const { dadosCalculadora: d, resultados: { opcaoSelecionada: o } } = estado;
        let msg = `*CONFIRMAÇÃO DE SIMULAÇÃO*\n\n*Cliente:* ${d.nomeCompletoCliente}\n*CPF:* ${d.cpfCliente}\n` +
                  `*Valor:* ${formatarMoeda(d.valorSolicitado)}\n\n*OPÇÃO ACEITA:*\n`;
        msg += o.tipo === 'parcelado' ? `Parcelado ${o.parcelas}x de ${formatarMoeda(o.valorParcela)}` : `Quitação em ${o.dia} dias (${formatarMoeda(o.valor)})`;
        msg += `\n\n✅ _Contrato aceito em ${formatarData(new Date())}._`;
        window.open(`https://wa.me/${CONFIG.numeroWhatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
    }
    
    // --- Inicialização ---
    (function init() {
        const stored = localStorage.getItem('calculadoraConfigAdmin');
        if (stored) CONFIG = { ...CONFIG, ...JSON.parse(stored) };
        const setTheme = theme => { document.body.className = `theme-${theme}`; localStorage.setItem('calcTheme', theme); };
        setTheme(localStorage.getItem('calcTheme') || 'dark');
        
        setupAdminPanel();
    
        document.body.addEventListener('click', e => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const id = btn.id;
            if (id.startsWith('btn-ir-para-etapa')) mostrarEtapa(estado.etapaAtual + 1);
            else if (id.startsWith('btn-voltar-para-etapa')) mostrarEtapa(estado.etapaAtual - 1);
        });
        
        getElem('form-faixa-preco').addEventListener('change', e => {
            if(e.target.type === 'radio'){
                estado.faixaPreco = { selecionada: true, valorPredefinido: e.target.value, limiteMaximo: parseFloat(e.target.dataset.limite) };
                getElem('btn-ir-para-etapa2').disabled = false;
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
            else if (btn.dataset.action === 'clear') atualizarValorCalculadora(0);
        });
        document.querySelector('.dias-pagamento-botoes').addEventListener('click', e => e.target.closest('.btn-dia') && selecionarDiaPagamento(e.target.closest('.btn-dia')));
        
        document.querySelector('.tab-buttons').addEventListener('click', e => e.target.closest('.tab-btn') && mostrarAbaPagamento(e.target.dataset.target.replace('resultado-','')));
        getElem('container-parcelado').addEventListener('click', e => e.target.closest('.opcao-resultado')?.dataset.id && selecionarOpcaoPagamento(e.target.closest('.opcao-resultado').dataset.id));
        getElem('container-diario-table').addEventListener('click', e => e.target.closest('tr')?.dataset.id && selecionarOpcaoPagamento(e.target.closest('tr').dataset.id));
        getElem('btn-toggle-prazo-diario').addEventListener('click', function() {
            const mostrando30 = this.dataset.showing === '30';
            document.querySelectorAll('tr.prazo-extendido').forEach(r => r.style.display = mostrando30 ? 'table-row' : 'none');
            this.dataset.showing = mostrando30 ? '60' : '30';
            this.textContent = mostrando30 ? '- Menos Prazo' : '+ Mais Prazo';
        });

        getElem('btn-finalizar-whatsapp').addEventListener('click', finalizarWhatsApp);
        getElem('aceito-contrato').addEventListener('change', e => getElem('btn-finalizar-whatsapp').disabled = !e.target.checked);

        getElem('theme-toggle-light').addEventListener('click', () => setTheme('light'));
        getElem('theme-toggle-dark').addEventListener('click', () => setTheme('dark'));
        
        mostrarEtapa(1);
    })();
});
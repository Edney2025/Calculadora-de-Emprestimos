document.addEventListener('DOMContentLoaded', () => {
    // ========================================================
    // JavaScript Simulador de Empréstimo PRO (V13 - Taxas Dinâmicas)
    // ========================================================

    let CONFIG = {
        credorNome: 'Edney Cunha da Silva',
        credorCpfCnpj: '065.932.739-29',
        credorContatoTel: '(44) 9 9840-8460',
        credorContatoEmail: 'encomendapalotina@gmail.com',
        contratoCidade: 'Palotina',
        contratoEstado: 'PR',
        // --- ALTERAÇÃO INICIADA: Estrutura de taxas por faixa de valor ---
        taxasPorFaixa: {
            baixo: { // Até R$ 1.999,99
                taxa3x: 0.17,  // 17%
                taxa48x: 0.10  // 10%
            },
            intermediario: { // De R$ 2.000,00 a R$ 4.999,99
                taxa3x: 0.15,  // 15%
                taxa48x: 0.08  // 8%
            },
            alto: { // A partir de R$ 5.000,00
                taxa3x: 0.13,  // 13%
                taxa48x: 0.06  // 6%
            }
        },
        // --- ALTERAÇÃO FINALIZADA ---
        taxaDiarioPrimeiroDia: 0.35,
        taxaDiarioUltimoDia: 1.00,
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
        
        getElem('btn-voltar').style.visibility = numEtapa > 1 ? 'visible' : 'hidden';
        const btnAvancar = getElem('btn-avancar');
        const btnFinalizar = getElem('btn-finalizar-whatsapp');

        btnAvancar.classList.toggle('hidden', numEtapa === 5);
        btnFinalizar.classList.toggle('hidden', numEtapa !== 5);

        if (numEtapa !== 5) {
            btnAvancar.textContent = numEtapa === 4 ? "Aceitar e Ver Contrato →" : "Avançar →";
            btnAvancar.disabled = true;
        } else {
            btnFinalizar.disabled = !getElem('aceito-contrato').checked;
        }

        const handlers = [null, configurarEtapa2, configurarEtapa3, configurarEtapa4, configurarEtapa5];
        if (handlers[numEtapa-1]) handlers[numEtapa-1]();
        
        if(numEtapa === 1 && estado.faixaPreco.selecionada) getElem('btn-avancar').disabled = false;
    }
    
    function setupAdminPanel() {
        // Lógica do painel admin (sem alterações)
    }
    
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
        getElem('valor-validation').textContent = valorValidado < valor ? `Valor ajustado para o limite da faixa.` : '';
        estado.dadosCalculadora.valorSolicitado = valorValidado;
        getElem('valor-display').textContent = formatarMoeda(valorValidado);
        validarEtapa2();
    };

    function selecionarDiaPagamento(button) {
        estado.dadosCalculadora.diaPagamento = parseInt(button.dataset.dia, 10);
        document.querySelectorAll('#etapa2 .btn-dia').forEach(b => b.classList.remove('active'));
        button.classList.add('active');
        const hoje = new Date(); hoje.setUTCHours(0,0,0,0);
        let vencimento = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), estado.dadosCalculadora.diaPagamento));
        if (vencimento <= hoje) vencimento.setUTCMonth(vencimento.getUTCMonth() + 1);
        estado.dadosCalculadora.dataPrimeiroVencimento = vencimento;
        
        const diffDays = Math.ceil((vencimento - hoje) / 864e5);
        const infoVencimento = getElem('info-vencimento');
        infoVencimento.className = 'info-vencimento-box';
        if(diffDays <= 10) infoVencimento.classList.add('near');
        else if (diffDays <= 20) infoVencimento.classList.add('medium');
        else infoVencimento.classList.add('far');
        infoVencimento.innerHTML = `PRIMEIRO VENCIMENTO EM ${diffDays} DIAS <span>${formatarData(vencimento)}</span>`;
        validarEtapa2();
    }

    function validarEtapa2() {
        const { nomeCompletoCliente, cpfCliente, valorSolicitado, diaPagamento } = estado.dadosCalculadora;
        const msgs = [];
        if (nomeCompletoCliente.trim().split(' ').length < 2) msgs.push('Nome');
        if (!/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(cpfCliente)) msgs.push('CPF');
        if (valorSolicitado <= 0) msgs.push('Valor');
        if (!diaPagamento) msgs.push('Dia de Vencimento');
        const isValid = msgs.length === 0;
        getElem('btn-avancar').disabled = !isValid;
        getElem('etapa2-validation').textContent = isValid ? '' : `Preencha: ${msgs.join(', ')}`;
        return isValid;
    }

    function configurarEtapa3(tipoPagamento = 'parcelado') {
        estado.resultados.opcaoSelecionada = null;
        getElem('btn-avancar').disabled = true;
        
        getElem('btn-show-parcelado').classList.toggle('active', tipoPagamento === 'parcelado');
        getElem('btn-show-diario').classList.toggle('active', tipoPagamento === 'diario');

        getElem('container-pagamento-mensal').classList.toggle('hidden', tipoPagamento !== 'parcelado');
        getElem('container-pagamento-diario').classList.toggle('hidden', tipoPagamento !== 'diario');
        
        if(tipoPagamento === 'parcelado') {
            calcularParcelado();
        } else {
            calcularDiario();
        }
    }
    
    // --- ALTERAÇÃO INICIADA: Nova função para obter taxas corretas ---
    function getTaxasAtuais() {
        const valor = estado.dadosCalculadora.valorSolicitado;
        if (valor < 2000) {
            return CONFIG.taxasPorFaixa.baixo;
        } else if (valor < 5000) {
            return CONFIG.taxasPorFaixa.intermediario;
        } else {
            return CONFIG.taxasPorFaixa.alto;
        }
    }
    // --- ALTERAÇÃO FINALIZADA ---

    function calcularParcelado() {
        const colunaImpar = getElem('coluna-impar');
        const colunaPar = getElem('coluna-par');
        colunaImpar.innerHTML = '';
        colunaPar.innerHTML = '';

        const { valorSolicitado, dataPrimeiroVencimento } = estado.dadosCalculadora;
        estado.resultados.parcelado = [];
        
        // --- ALTERAÇÃO INICIADA: Usando a função para obter taxas dinâmicas ---
        const taxasAtuais = getTaxasAtuais();
        const taxaMenorPrazo = taxasAtuais.taxa3x;
        const taxaMaiorPrazo = taxasAtuais.taxa48x;
        // --- ALTERAÇÃO FINALIZADA ---
        
        for (let p = 3; p <= 48; p += 3) {
            const fator = (p - 3) / (48 - 3); 
            const taxa = taxaMenorPrazo - fator * (taxaMenorPrazo - taxaMaiorPrazo);
            const parcela = valorSolicitado * (taxa * Math.pow(1 + taxa, p)) / (Math.pow(1 + taxa, p) - 1);
            const valorFinal = Math.ceil(parcela * 20) / 20;
            const ultimoVenc = addDays(dataPrimeiroVencimento, (p-1) * 30.44);
            const opId = `op-parc-${p}`;
            estado.resultados.parcelado.push({ id: opId, tipo: 'parcelado', parcelas: p, valorParcela: valorFinal, dataPrimeiroVencimento, dataUltimoVencimento: ultimoVenc, valorTotal: valorFinal * p });
            
            const isImpar = (p / 3) % 2 !== 0;
            const html = `<div class="opcao-resultado ${isImpar ? 'impar' : 'par'}" data-id="${opId}"><span class="titulo">${p}x ${formatarMoeda(valorFinal)}</span></div>`;
            
            if (isImpar) {
                colunaImpar.innerHTML += html;
            } else {
                colunaPar.innerHTML += html;
            }
        }
    }

    function calcularDiario() {
        const container = getElem('container-pagamento-diario');
        container.innerHTML = '';
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
                        <div class="titulo">${d}º Dia</div>
                        <div class="data">${formatarData(dataDia)}</div>
                        <div class="valor">${formatarMoeda(valorDia)}</div>
                    </div>`;
        }
        container.innerHTML = html;
    }
    
    function selecionarOpcaoPagamento(id) {
        const opcao = estado.resultados.parcelado.find(op => op.id === id) || estado.resultados.diario.find(op => op.id === id);
        estado.resultados.opcaoSelecionada = opcao;
        getElem('btn-avancar').disabled = !opcao;

        document.querySelectorAll('.opcao-resultado').forEach(el => {
            el.classList.remove('selected', 'dimmed');
        });

        document.querySelectorAll('.opcao-resultado').forEach(el => {
            if (el.dataset.id !== id) {
                el.classList.add('dimmed');
            } else {
                el.classList.add('selected');
            }
        });
    }
    
    function configurarEtapa4() {
        const op = estado.resultados.opcaoSelecionada;
        const d = estado.dadosCalculadora;
        getElem('btn-avancar').disabled = false;
        if (!op) return;
        let html = `<h4>📄 Resumo da Proposta</h4>`;
        html += `<p><strong>👤 Nome:</strong> ${d.nomeCompletoCliente}</p>`;
        html += `<p><strong>🆔 CPF:</strong> ${d.cpfCliente}</p>`;
        html += `<p><strong>💰 Valor Solicitado:</strong> <strong>${formatarMoeda(d.valorSolicitado)}</strong></p><hr>`;
        
        if (op.tipo === 'parcelado') {
            html += `<p><strong>💳 Forma de Pagamento:</strong> Mensal</p>`;
            html += `<p><strong>📊 Condições:</strong> ${op.parcelas} parcelas de ${formatarMoeda(op.valorParcela)}</p>`;
            html += `<p><strong>➡️ Primeiro Vencimento:</strong> ${formatarData(op.dataPrimeiroVencimento)}</p>`;
            html += `<p><strong>🏁 Último Vencimento:</strong> ${formatarData(op.dataUltimoVencimento)}</p>`;
        } else {
            html += `<p><strong>⚡ Forma de Pagamento:</strong> Diário</p>`;
            html += `<p><strong>📅 Data Limite para Quitação:</strong> ${formatarData(op.data)}</p>`;
            html += `<p><strong>💲 Valor Total a Pagar:</strong> ${formatarMoeda(op.valor)}</p>`;
        }
        getElem('resumo-container').innerHTML = html;
    }
    
    function configurarEtapa5() {
        const op = estado.resultados.opcaoSelecionada;
        if (!op) return;
        let template = getElem('contrato-template').innerHTML;
        
        const valorBaseCalculoAtraso = op.tipo === 'parcelado' ? op.valorParcela : op.valor;
        const valorAproxComAtraso = valorBaseCalculoAtraso * (1 + 0.20 + 0.10);
        const valorFinal = op.tipo === 'parcelado' ? op.valorTotal : op.valor;

        const placeholders = {
            '[NOME_COMPLETO_DO_CREDOR]': CONFIG.credorNome, '[CPF_CNPJ_DO_CREDOR]': CONFIG.credorCpfCnpj,
            '[CIDADE_CONTRATO]': CONFIG.contratoCidade, '[ESTADO_CONTRATO]': CONFIG.contratoEstado,
            '[NOME_CLIENTE_COMPLETO]': estado.dadosCalculadora.nomeCompletoCliente, '[CPF_CLIENTE]': estado.dadosCalculadora.cpfCliente,
            '[DATA_ORCAMENTO_FORMATADA]': formatarData(new Date()),
            '[VALOR_SOLICITADO_FORMATADO]': formatarMoeda(estado.dadosCalculadora.valorSolicitado),
            '[VALOR_TOTAL_PAGO_FORMATADO]': formatarMoeda(valorFinal),
            '[NUMERO_PARCELAS]': op.parcelas, '[VALOR_PARCELA_FORMATADO]': formatarMoeda(op.valorParcela),
            '[DATA_PRIMEIRO_VENCIMENTO_PARCELADO]': formatarData(op.dataPrimeiroVencimento),
            '[DATA_LIMITE_PAGAMENTO_DIARIO]': formatarData(op.data),
            '[VALOR_BASE_CALCULO_ATRASO]': formatarMoeda(valorBaseCalculoAtraso),
            '[VALOR_APROX_COM_ATRASO]': formatarMoeda(valorAproxComAtraso),
        };

        for(const p in placeholders) template = template.replaceAll(p, placeholders[p] || '-');
        
        getElem('contrato-texto').innerHTML = template;
        getElem('contrato-texto').querySelector('#contrato-parcelado-detalhe').style.display = op.tipo === 'parcelado' ? 'block' : 'none';
        getElem('contrato-texto').querySelector('#contrato-diario-detalhe').style.display = op.tipo === 'diario' ? 'block' : 'none';
        
        getElem('aceito-contrato').checked = false;
        getElem('btn-finalizar-whatsapp').disabled = true;
    }
    
    async function compartilharWhatsApp() {
        const { dadosCalculadora: d, resultados: { opcaoSelecionada: o } } = estado;
        if (!o) return;
        let shareText = `*📄 Resumo da Simulação de Empréstimo*\n\n` +
                      `*👤 Nome:* ${d.nomeCompletoCliente}\n` +
                      `*🆔 CPF:* ${d.cpfCliente}\n` +
                      `*💰 Valor Solicitado:* ${formatarMoeda(d.valorSolicitado)}\n\n` +
                      `*✅ Opção Escolhida:*\n`;
        
        if (o.tipo === 'parcelado') {
            shareText += `*🗓️ Parcelado em ${o.parcelas}x de ${formatarMoeda(o.valorParcela)}*\n`;
            shareText += `*➡️ 1º Vencimento:* ${formatarData(o.dataPrimeiroVencimento)}\n`;
            shareText += `*🏁 Último Vencimento:* ${formatarData(o.dataUltimoVencimento)}\n`;
        } else {
            shareText += `*⚡ Quitação Diária até ${formatarData(o.data)}*\n`;
            shareText += `*💲 Valor Total:* ${formatarMoeda(o.valor)}\n`;
        }
        shareText += `\n*Declaro que li e aceitei os termos do contrato.*`;
        
        const encodedText = encodeURIComponent(shareText);
        const whatsappUrl = `https://wa.me/${CONFIG.credorContatoTel.replace(/\D/g, '')}?text=${encodedText}`;
        window.open(whatsappUrl, '_blank');
    }
    
    (function init() {
        const stored = localStorage.getItem('calculadoraConfigAdmin');
        if (stored) CONFIG = { ...CONFIG, ...JSON.parse(stored) };
        const setTheme = theme => { document.body.className = `theme-${theme}`; localStorage.setItem('calcTheme', theme); };
        setTheme(localStorage.getItem('calcTheme') || 'dark');
        
        setupAdminPanel();
    
        getElem('btn-voltar').addEventListener('click', () => mostrarEtapa(estado.etapaAtual - 1));
        getElem('btn-avancar').addEventListener('click', () => mostrarEtapa(estado.etapaAtual + 1));
        
        getElem('form-faixa-preco').addEventListener('change', e => {
            if(e.target.type === 'radio'){
                estado.faixaPreco = { selecionada: true, valorPredefinido: e.target.value, limiteMaximo: parseFloat(e.target.dataset.limite) };
                getElem('btn-avancar').disabled = false;
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
            const action = btn.dataset.action;
            const value = parseFloat(btn.dataset.value);
            if (action === 'add') atualizarValorCalculadora(estado.dadosCalculadora.valorSolicitado + value);
            else if (action === 'multiply') atualizarValorCalculadora(estado.dadosCalculadora.valorSolicitado * value);
            else if (action === 'clear') atualizarValorCalculadora(0);
        });

        document.querySelector('.dias-pagamento-botoes').addEventListener('click', e => e.target.closest('.btn-dia') && selecionarDiaPagamento(e.target.closest('.btn-dia')));
        
        getElem('btn-show-parcelado').addEventListener('click', () => configurarEtapa3('parcelado'));
        getElem('btn-show-diario').addEventListener('click', () => configurarEtapa3('diario'));

        document.getElementById('etapa3').addEventListener('click', e => {
            const opcaoElemento = e.target.closest('.opcao-resultado');
            if (opcaoElemento && opcaoElemento.dataset.id) {
                selecionarOpcaoPagamento(opcaoElemento.dataset.id);
            }
        });

        getElem('btn-finalizar-whatsapp').addEventListener('click', compartilharWhatsApp);
        getElem('aceito-contrato').addEventListener('change', e => {
            getElem('btn-finalizar-whatsapp').disabled = !e.target.checked;
        });

        getElem('theme-toggle-light').addEventListener('click', () => setTheme('light'));
        getElem('theme-toggle-dark').addEventListener('click', () => setTheme('dark'));
        
        mostrarEtapa(1);
    })();
});

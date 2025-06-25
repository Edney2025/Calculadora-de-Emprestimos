document.addEventListener('DOMContentLoaded', () => {
    let CONFIG = {
        credorNome: 'Edney Cunha da Silva',
        credorCpfCnpj: '065.932.739-29',
        credorContatoTel: '5544998408460',
        credorEndereco: 'Rua Exemplo, 123, Centro, Palotina, PR, CEP 85950-000',
        contratoCidade: 'Palotina',
        contratoEstado: 'PR',
        taxaJurosInicial: 0.15, // 15% para 3x
        taxaJurosFinal: 0.10,   // 10% para 36x
        iofFixoPerc: 0.0038,
        iofDiarioPerc: 0.000082,
        adminPassword: '6836',
    };

    let estado = {
        etapaAtual: 1,
        faixaPreco: { selecionada: false, min: 0, max: 0 },
        dadosCalculadora: {
            valorSolicitado: 0,
            nomeCompletoCliente: '',
            cpfCliente: '',
            enderecoCliente: '',
            diaPagamento: null,
            dataPrimeiroVencimento: null,
        },
        resultados: { opcoes: [], opcaoSelecionada: null },
    };

    const getElem = id => document.getElementById(id);
    const formatarMoeda = valor => (Number(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const formatarData = data => data instanceof Date && !isNaN(data) ? data.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '--/--/----';

    function numeroPorExtenso(valor) {
        const unidades = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
        const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
        const especiais = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezessis', 'dezessete', 'dezoito', 'dezenove'];
        const centenas = ['cem', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

        function converterAte999(num) {
            if (num === 0) return '';
            if (num < 10) return unidades[num];
            if (num < 20) return especiais[num - 10];
            if (num < 100) {
                const dez = Math.floor(num / 10);
                const uni = num % 10;
                return `${dezenas[dez]}${uni ? ' e ' + unidades[uni] : ''}`;
            }
            const cent = Math.floor(num / 100);
            const resto = num % 100;
            return `${centenas[cent]}${resto ? ' e ' + converterAte999(resto) : ''}`;
        }

        function converterReais(valor) {
            const inteiro = Math.floor(valor);
            const centavos = Math.round((valor - inteiro) * 100);
            let texto = '';
            if (inteiro === 0 && centavos === 0) return 'zero reais';
            if (inteiro > 0) {
                texto += converterAte999(inteiro) + (inteiro === 1 ? ' real' : ' reais');
            }
            if (centavos > 0) {
                texto += (inteiro > 0 ? ' e ' : '') + converterAte999(centavos) + (centavos === 1 ? ' centavo' : ' centavos');
            }
            return texto;
        }

        return converterReais(valor);
    }

    function calcularTaxaJuros(numParcelas) {
        const pMin = 3, pMax = 36;
        const taxaInicial = CONFIG.taxaJurosInicial;
        const taxaFinal = CONFIG.taxaJurosFinal;
        return taxaInicial - ((taxaInicial - taxaFinal) * (numParcelas - pMin)) / (pMax - pMin);
    }

    function calcularOpcao(valor, numParcelas) {
        const diasCorridos = numParcelas * 30;
        const diasParaCalculoIOF = Math.min(diasCorridos, 365);
        const valorIOFFixo = valor * CONFIG.iofFixoPerc;
        const valorIOFDiario = valor * CONFIG.iofDiarioPerc * diasParaCalculoIOF;
        const valorFinanciado = valor + valorIOFFixo + valorIOFDiario;
        const taxaJuros = calcularTaxaJuros(numParcelas);
        const i = taxaJuros, n = numParcelas;
        const valorParcela = (i > 0) ? valorFinanciado * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1) : valorFinanciado / n;
        return { numParcelas, valorParcela, valorFinanciado, valorTotal: valorParcela * numParcelas, taxaJuros };
    }

    function gerarTabelaAmortizacao(opcao) {
        let saldoDevedor = opcao.valorFinanciado, tabela = [];
        for (let i = 1; i <= opcao.numParcelas; i++) {
            const juros = saldoDevedor * opcao.taxaJuros;
            let amortizacao = opcao.valorParcela - juros;
            saldoDevedor -= amortizacao;
            if (i === opcao.numParcelas && Math.abs(saldoDevedor) > 0.01) amortizacao += saldoDevedor;
            const dataVencimento = new Date(estado.dadosCalculadora.dataPrimeiroVencimento);
            dataVencimento.setUTCMonth(dataVencimento.getUTCMonth() + i - 1);
            tabela.push({ parcelaNum: i, juros, amortizacao, vencimento: formatarData(dataVencimento) });
        }
        return tabela;
    }

    function mostrarAlerta(titulo, mensagem, callback) {
        getElem('alert-title').textContent = titulo;
        getElem('alert-message').innerHTML = mensagem.replace(/\n/g, '<br>');
        getElem('alert-overlay').classList.remove('hidden');
        const okBtn = getElem('alert-ok-btn');
        const handler = () => {
            getElem('alert-overlay').classList.add('hidden');
            okBtn.removeEventListener('click', handler);
            okBtn.removeEventListener('touchstart', handler);
            if (callback) callback();
        };
        okBtn.addEventListener('click', handler);
        okBtn.addEventListener('touchstart', handler);
    }

    function mostrarEtapa(numEtapa) {
        if (numEtapa > estado.etapaAtual && !validarEtapa(estado.etapaAtual)) return;
        estado.etapaAtual = numEtapa;
        document.querySelectorAll('.etapa').forEach(e => e.classList.remove('ativa'));
        getElem(`etapa${numEtapa}`).classList.add('ativa');
        document.querySelectorAll('.progress-step').forEach(e => e.classList.toggle('active', parseInt(e.dataset.step) <= numEtapa));
        getElem('btn-voltar').classList.toggle('hidden', numEtapa === 1);
        getElem('btn-avancar').classList.toggle('hidden', numEtapa === 5);
        getElem('btn-finalizar-whatsapp').classList.toggle('hidden', numEtapa !== 5);
        if (numEtapa === 2) getElem('limite-valor-info').textContent = `Permitido entre ${formatarMoeda(estado.faixaPreco.min)} e ${formatarMoeda(estado.faixaPreco.max)}`;
        if (numEtapa === 3) gerarOpcoesDePagamento();
        if (numEtapa === 4) configurarEtapa4();
        if (numEtapa === 5) configurarEtapa5();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        atualizarEstadoBotoes();
    }

    function validarEtapa(numEtapa) {
        let isValid = true, errorMsg = '';
        if (numEtapa === 1) {
            isValid = estado.faixaPreco.selecionada;
            if (!isValid) errorMsg = 'Por favor, selecione uma faixa de valor.';
            getElem('etapa1-validation').textContent = errorMsg;
        }
        if (numEtapa === 2) {
            const erros = [];
            const valor = parseFloat(getElem('valor-emprestimo').value);
            const nome = getElem('nome-completo-cliente').value.trim();
            const cpf = getElem('cpf-cliente').value.trim();
            const endereco = getElem('endereco-cliente').value.trim();
            const diaPagamento = estado.dadosCalculadora.diaPagamento;

            if (isNaN(valor) || valor < estado.faixaPreco.min || valor > estado.faixaPreco.max) erros.push(`valor (entre ${formatarMoeda(estado.faixaPreco.min)} e ${formatarMoeda(estado.faixaPreco.max)})`);
            if (nome.split(' ').length < 2) erros.push('nome completo');
            if (!validarCPF(cpf)) erros.push('CPF válido');
            if (endereco.length < 10) erros.push('endereço completo');
            if (!diaPagamento) erros.push('dia de pagamento');

            if (erros.length > 0) {
                isValid = false;
                errorMsg = `É necessário preencher: ${erros.join(', ')}.`;
            } else {
                estado.dadosCalculadora = { ...estado.dadosCalculadora, valorSolicitado: valor, nomeCompletoCliente: nome, cpfCliente: cpf, enderecoCliente: endereco };
            }
            getElem('etapa2-validation').textContent = errorMsg;
        }
        if (numEtapa === 3) {
            isValid = !!estado.resultados.opcaoSelecionada;
            if (!isValid) errorMsg = 'Selecione uma opção de parcelamento.';
            getElem('etapa3-validation').textContent = errorMsg;
        }
        if (numEtapa === 5) {
            isValid = getElem('aceito-contrato').checked;
            if (!isValid) errorMsg = 'Você deve aceitar os termos do contrato.';
            getElem('contrato-validation').textContent = errorMsg;
        }
        return isValid;
    }

    function atualizarEstadoBotoes() {
        if (estado.etapaAtual < 5) {
            getElem('btn-avancar').disabled = !validarEtapa(estado.etapaAtual);
            getElem('btn-finalizar-whatsapp').disabled = true;
        } else {
            const contratoAceito = getElem('aceito-contrato').checked;
            getElem('btn-avancar').disabled = true;
            getElem('btn-finalizar-whatsapp').disabled = !contratoAceito;
        }
    }

    function gerarOpcoesDePagamento() {
        const container = getElem('container-pagamento-mensal');
        container.innerHTML = '';
        estado.resultados.opcoes = [];
        for (let p = 3; p <= 36; p += 3) {
            const opcao = calcularOpcao(estado.dadosCalculadora.valorSolicitado, p);
            estado.resultados.opcoes.push(opcao);
            const div = document.createElement('div');
            div.className = 'opcao-resultado';
            div.dataset.parcelas = p;
            div.innerHTML = `<strong>${p}x</strong> de ${formatarMoeda(opcao.valorParcela)}`;
            div.addEventListener('click', () => selecionarOpcaoPagamento(p));
            div.addEventListener('touchstart', () => selecionarOpcaoPagamento(p));
            container.appendChild(div);
        }
        estado.resultados.opcoes.sort((a, b) => b.valorParcela - a.valorParcela);
    }

    function selecionarOpcaoPagamento(numParcelas) {
        estado.resultados.opcaoSelecionada = estado.resultados.opcoes.find(op => op.numParcelas === numParcelas);
        document.querySelectorAll('.opcao-resultado').forEach(el => {
            el.classList.toggle('selected', el.dataset.parcelas == numParcelas);
            el.classList.add('dimmed');
        });
        document.querySelector('.opcao-resultado.selected')?.classList.remove('dimmed');
        atualizarEstadoBotoes();
    }

    function configurarEtapa4() {
        const container = getElem('resumo-container'), op = estado.resultados.opcaoSelecionada;
        if (!op) { container.innerHTML = '<p>Selecione uma opção na etapa anterior.</p>'; return; }
        const tabela = gerarTabelaAmortizacao(op);
        const dataPrimeiroVenc = new Date(estado.dadosCalculadora.dataPrimeiroVencimento);
        const dataUltimoVenc = new Date(dataPrimeiroVenc);
        dataUltimoVenc.setUTCMonth(dataUltimoVenc.getUTCMonth() + op.numParcelas - 1);
        const faixaSelecionada = `R$ ${estado.faixaPreco.min.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} - R$ ${estado.faixaPreco.max.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        container.innerHTML = `
            <div class="summary-grid">
                <div class="summary-card"><span>👤 Nome do Cliente</span><strong>${estado.dadosCalculadora.nomeCompletoCliente}</strong></div>
                <div class="summary-card"><span>🆔 CPF do Cliente</span><strong>${estado.dadosCalculadora.cpfCliente}</strong></div>
                <div class="summary-card"><span>🏠 Endereço</span><strong>${estado.dadosCalculadora.enderecoCliente}</strong></div>
                <div class="summary-card"><span>📅 Data da Solicitação</span><strong>${formatarData(new Date())}</strong></div>
                <div class="summary-card"><span>💰 Valor do Empréstimo</span><strong>${formatarMoeda(estado.dadosCalculadora.valorSolicitado)}</strong></div>
                <div class="summary-card"><span>💳 Parcela Mensal</span><strong>${formatarMoeda(op.valorParcela)}</strong></div>
                <div class="summary-card"><span>📆 Data da Primeira Parcela</span><strong>${formatarData(dataPrimeiroVenc)}</strong></div>
                <div class="summary-card"><span>📆 Data da Última Parcela</span><strong>${formatarData(dataUltimoVenc)}</strong></div>
            </div>
            <h3>Detalhamento das Parcelas</h3>
            <div class="table-container">
                <table>
                    <thead><tr><th>Nº</th><th>Vencimento</th><th>Valor</th></tr></thead>
                    <tbody>
                        ${tabela.map(r => `<tr><td>${r.parcelaNum}</td><td>${r.vencimento}</td><td><strong>${formatarMoeda(op.valorParcela)}</strong></td></tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
    }

    function configurarEtapa5() {
        const op = estado.resultados.opcaoSelecionada; if (!op) return;
        const dataPrimeiroVenc = new Date(estado.dadosCalculadora.dataPrimeiroVencimento);
        const dataUltimoVenc = new Date(dataPrimeiroVenc);
        dataUltimoVenc.setUTCMonth(dataUltimoVenc.getUTCMonth() + op.numParcelas - 1);
        const multaExemplo = op.valorParcela * 0.20;
        const jurosExemplo = op.valorParcela * 0.10;
        const totalAtrasoExemplo = op.valorParcela + multaExemplo + jurosExemplo;
        let template = getElem('contrato-template').innerHTML;
        const placeholders = {
            '[CONTRATO_NUMERO]': `${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
            '[DATA_ORCAMENTO_FORMATADA]': formatarData(new Date()),
            '[NOME_COMPLETO_DO_CREDOR]': CONFIG.credorNome,
            '[CPF_CNPJ_DO_CREDOR]': CONFIG.credorCpfCnpj,
            '[ENDERECO_CREDOR]': CONFIG.credorEndereco,
            '[TELEFONE_DO_CREDOR]': CONFIG.credorContatoTel.replace(/^55/, ''),
            '[NOME_CLIENTE_COMPLETO]': estado.dadosCalculadora.nomeCompletoCliente,
            '[CPF_CLIENTE]': estado.dadosCalculadora.cpfCliente,
            '[ENDERECO_CLIENTE]': estado.dadosCalculadora.enderecoCliente,
            '[VALOR_SOLICITADO_FORMATADO]': formatarMoeda(estado.dadosCalculadora.valorSolicitado),
            '[VALOR_SOLICITADO_EXTENSO]': numeroPorExtenso(estado.dadosCalculadora.valorSolicitado),
            '[NUMERO_PARCELAS]': op.numParcelas,
            '[NUMERO_PARCELAS_EXTENSO]': numeroPorExtenso(op.numParcelas),
            '[VALOR_PARCELA_FORMATADO]': formatarMoeda(op.valorParcela),
            '[DIA_PAGAMENTO]': estado.dadosCalculadora.diaPagamento,
            '[DATA_PRIMEIRO_VENCIMENTO_PARCELADO]': formatarData(dataPrimeiroVenc),
            '[DATA_ULTIMO_VENCIMENTO_PARCELADO]': formatarData(dataUltimoVenc),
            '[VALOR_TOTAL_PAGO_FORMATADO]': formatarMoeda(op.valorTotal),
            '[VALOR_TOTAL_PAGO_EXTENSO]': numeroPorExtenso(op.valorTotal),
            '[CPF_CREDOR]': CONFIG.credorCpfCnpj,
            '[CIDADE_CONTRATO]': CONFIG.contratoCidade,
            '[ESTADO_CONTRATO]': CONFIG.contratoEstado,
            '[MULTA_EXEMPLO]': formatarMoeda(multaExemplo),
            '[JUROS_EXEMPLO]': formatarMoeda(jurosExemplo),
            '[TOTAL_ATRASO_EXEMPLO]': formatarMoeda(totalAtrasoExemplo),
        };
        for (const p in placeholders) template = template.replaceAll(p, placeholders[p]);
        getElem('contrato-texto').innerHTML = template;
        getElem('aceito-contrato').checked = false;
        atualizarEstadoBotoes();
    }

    function compartilharWhatsApp() {
        if (!getElem('aceito-contrato').checked) {
            mostrarAlerta('Erro', 'Você deve aceitar os termos do contrato antes de enviar.', () => {});
            return;
        }
        const { dadosCalculadora: d, resultados: { opcaoSelecionada: o } } = estado; if (!o) return;
        const dataPrimeiroVenc = new Date(d.dataPrimeiroVencimento);
        const dataUltimoVenc = new Date(dataPrimeiroVenc);
        dataUltimoVenc.setUTCMonth(dataUltimoVenc.getUTCMonth() + o.numParcelas - 1);
        const faixaSelecionada = `R$ ${estado.faixaPreco.min.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} - R$ ${estado.faixaPreco.max.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        let txt = `Olá tudo bem?\n\n` +
                 `Segue a solicitação de empréstimo realizada por ${d.nomeCompletoCliente}:\n\n` +
                 `CPF: ${d.cpfCliente}\n` +
                 `Endereço: ${d.enderecoCliente}\n\n` +
                 `**Detalhes do Empréstimo**\n` +
                 `Valor Solicitado: ${formatarMoeda(d.valorSolicitado)}\n` +
                 `Data da Solicitação: ${formatarData(new Date())}\n` +
                 `Parcelamento: ${o.numParcelas}x de ${formatarMoeda(o.valorParcela)}\n` +
                 `Dia de Pagamento: ${d.diaPagamento} de cada mês\n` +
                 `Primeira Parcela: ${formatarData(dataPrimeiroVenc)}\n` +
                 `Última Parcela: ${formatarData(dataUltimoVenc)}\n\n` +
                 `**Contrato**\n` +
                 `O cliente aceitou digitalmente os termos do contrato de mútuo financeiro.\n\n` +
                 `Aguardamos a análise inicial em até 24 horas e a aprovação final entre 05 e 30 dias, conforme o valor solicitado.\n\n` +
                 `Atenciosamente,\n${d.nomeCompletoCliente}`;
        const mensagemAlerta = `Sua solicitação foi recebida com sucesso!\n\n` +
                              `A primeira etapa de avaliação ocorrerá em até 24 horas.\n` +
                              `O prazo para a aprovação final e liberação do valor é de 05 a 30 dias, a depender do montante solicitado e da análise de crédito. Este período é necessário para realizarmos todas as verificações com segurança.\n\n` +
                              `Clique em "OK" para continuar e nos enviar sua solicitação via WhatsApp.`;
        mostrarAlerta('Atenção: Prazos de Análise', mensagemAlerta, () => {
            window.open(`https://wa.me/${CONFIG.credorContatoTel}?text=${encodeURIComponent(txt)}`, '_blank');
        });
    }

    function validarCPF(cpf) {
        cpf = String(cpf).replace(/[^\d]+/g, '');
        if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
        let s = 0, r;
        for (let i = 1; i <= 9; i++) s += parseInt(cpf.charAt(i - 1)) * (11 - i);
        r = (s * 10) % 11; if (r === 10 || r === 11) r = 0;
        if (r !== parseInt(cpf.charAt(9))) return false;
        s = 0;
        for (let i = 1; i <= 10; i++) s += parseInt(cpf.charAt(i - 1)) * (12 - i);
        r = (s * 10) % 11; if (r === 10 || r === 11) r = 0;
        return r === parseInt(cpf.charAt(10));
    }

    function setupAdminPanel() {
        const adminBtn = getElem('prev-settings-btn');
        let clickCount = 0;
        let clickTimer;
        const showAdminPanel = () => {
            clickCount++;
            clearTimeout(clickTimer);
            clickTimer = setTimeout(() => { clickCount = 0; }, 1500);
            if (clickCount >= 7) {
                adminBtn.classList.remove('hidden');
                clickCount = 0;
            }
        };
        getElem('logo-area').addEventListener('click', showAdminPanel);
        getElem('logo-area').addEventListener('touchstart', showAdminPanel);

        adminBtn.addEventListener('click', () => getElem('admin-password-overlay').classList.remove('hidden'));
        adminBtn.addEventListener('touchstart', () => getElem('admin-password-overlay').classList.remove('hidden'));
        getElem('admin-cancel-btn').addEventListener('click', () => getElem('admin-password-overlay').classList.add('hidden'));
        getElem('admin-cancel-btn').addEventListener('touchstart', () => getElem('admin-password-overlay').classList.add('hidden'));
        getElem('admin-close-panel-btn').addEventListener('click', () => getElem('admin-settings').classList.remove('active'));
        getElem('admin-close-panel-btn').addEventListener('touchstart', () => getElem('admin-settings').classList.remove('active'));

        getElem('admin-login-btn').addEventListener('click', () => {
            if (getElem('admin-password-input').value === CONFIG.adminPassword) {
                getElem('admin_credor_nome').value = CONFIG.credorNome;
                getElem('admin_credor_cpf_cnpj').value = CONFIG.credorCpfCnpj;
                getElem('admin_credor_contato_tel').value = CONFIG.credorContatoTel;
                getElem('admin_credor_endereco').value = CONFIG.credorEndereco;
                getElem('admin_contrato_cidade').value = CONFIG.contratoCidade;
                getElem('admin_contrato_estado').value = CONFIG.contratoEstado;
                getElem('admin_taxa_juros_inicial').value = (CONFIG.taxaJurosInicial * 100).toFixed(2);
                getElem('admin_taxa_juros_final').value = (CONFIG.taxaJurosFinal * 100).toFixed(2);
                getElem('admin_iof_fixo').value = (CONFIG.iofFixoPerc * 100).toFixed(2);
                getElem('admin_iof_diario').value = (CONFIG.iofDiarioPerc * 100).toFixed(4);
                getElem('admin-password-overlay').classList.add('hidden');
                getElem('admin-settings').classList.add('active');
                getElem('admin-password-input').value = '';
                getElem('admin-password-error').textContent = '';
            } else {
                getElem('admin-password-error').textContent = 'Senha inválida.';
            }
        });
        getElem('admin-login-btn').addEventListener('touchstart', () => {
            if (getElem('admin-password-input').value === CONFIG.adminPassword) {
                getElem('admin_credor_nome').value = CONFIG.credorNome;
                getElem('admin_credor_cpf_cnpj').value = CONFIG.credorCpfCnpj;
                getElem('admin_credor_contato_tel').value = CONFIG.credorContatoTel;
                getElem('admin_credor_endereco').value = CONFIG.credorEndereco;
                getElem('admin_contrato_cidade').value = CONFIG.contratoCidade;
                getElem('admin_contrato_estado').value = CONFIG.contratoEstado;
                getElem('admin_taxa_juros_inicial').value = (CONFIG.taxaJurosInicial * 100).toFixed(2);
                getElem('admin_taxa_juros_final').value = (CONFIG.taxaJurosFinal * 100).toFixed(2);
                getElem('admin_iof_fixo').value = (CONFIG.iofFixoPerc * 100).toFixed(2);
                getElem('admin_iof_diario').value = (CONFIG.iofDiarioPerc * 100).toFixed(4);
                getElem('admin-password-overlay').classList.add('hidden');
                getElem('admin-settings').classList.add('active');
                getElem('admin-password-input').value = '';
                getElem('admin-password-error').textContent = '';
            } else {
                getElem('admin-password-error').textContent = 'Senha inválida.';
            }
        });

        getElem('admin-save-settings-btn').addEventListener('click', () => {
            CONFIG.credorNome = getElem('admin_credor_nome').value;
            CONFIG.credorCpfCnpj = getElem('admin_credor_cpf_cnpj').value;
            CONFIG.credorContatoTel = getElem('admin_credor_contato_tel').value;
            CONFIG.credorEndereco = getElem('admin_credor_endereco').value;
            CONFIG.contratoCidade = getElem('admin_contrato_cidade').value;
            CONFIG.contratoEstado = getElem('admin_contrato_estado').value;
            CONFIG.taxaJurosInicial = parseFloat(getElem('admin_taxa_juros_inicial').value) / 100;
            CONFIG.taxaJurosFinal = parseFloat(getElem('admin_taxa_juros_final').value) / 100;
            CONFIG.iofFixoPerc = parseFloat(getElem('admin_iof_fixo').value) / 100;
            CONFIG.iofDiarioPerc = parseFloat(getElem('admin_iof_diario').value) / 100;
            localStorage.setItem('calculadoraProConfig', JSON.stringify(CONFIG));
            getElem('admin-settings').classList.remove('active');
            alert('Configurações salvas!');
        });
        getElem('admin-save-settings-btn').addEventListener('touchstart', () => {
            CONFIG.credorNome = getElem('admin_credor_nome').value;
            CONFIG.credorCpfCnpj = getElem('admin_credor_cpf_cnpj').value;
            CONFIG.credorContatoTel = getElem('admin_credor_contato_tel').value;
            CONFIG.credorEndereco = getElem('admin_credor_endereco').value;
            CONFIG.contratoCidade = getElem('admin_contrato_cidade').value;
            CONFIG.contratoEstado = getElem('admin_contrato_estado').value;
            CONFIG.taxaJurosInicial = parseFloat(getElem('admin_taxa_juros_inicial').value) / 100;
            CONFIG.taxaJurosFinal = parseFloat(getElem('admin_taxa_juros_final').value) / 100;
            CONFIG.iofFixoPerc = parseFloat(getElem('admin_iof_fixo').value) / 100;
            CONFIG.iofDiarioPerc = parseFloat(getElem('admin_iof_diario').value) / 100;
            localStorage.setItem('calculadoraProConfig', JSON.stringify(CONFIG));
            getElem('admin-settings').classList.remove('active');
            alert('Configurações salvas!');
        });
    }

    (function init() {
        const storedConfig = localStorage.getItem('calculadoraProConfig');
        if (storedConfig) CONFIG = { ...CONFIG, ...JSON.parse(storedConfig) };

        getElem('btn-reiniciar').addEventListener('click', () => window.location.reload());
        getElem('btn-reiniciar').addEventListener('touchstart', () => window.location.reload());
        getElem('btn-voltar').addEventListener('click', () => mostrarEtapa(estado.etapaAtual - 1));
        getElem('btn-voltar').addEventListener('touchstart', () => mostrarEtapa(estado.etapaAtual - 1));
        getElem('btn-avancar').addEventListener('click', () => mostrarEtapa(estado.etapaAtual + 1));
        getElem('btn-avancar').addEventListener('touchstart', () => mostrarEtapa(estado.etapaAtual + 1));

        getElem('form-faixa-preco').addEventListener('change', e => {
            if (e.target.name === 'faixa_valor') {
                estado.faixaPreco = { selecionada: true, min: parseFloat(e.target.dataset.min), max: parseFloat(e.target.dataset.max) };
                getElem('valor-emprestimo').value = e.target.dataset.min;
                atualizarEstadoBotoes();
            }
        });

        document.querySelector('.preset-buttons').addEventListener('click', e => {
            const btn = e.target.closest('.preset-btn'); if (!btn) return;
            const action = btn.dataset.action, value = parseFloat(btn.dataset.value);
            const input = getElem('valor-emprestimo');
            let currentValue = parseFloat(input.value) || 0;
            if (action === 'add') currentValue += value;
            else if (action === 'multiply') currentValue *= value;
            else if (action === 'clear') currentValue = 0;
            input.value = currentValue.toFixed(2);
            atualizarEstadoBotoes();
        });
        document.querySelector('.preset-buttons').addEventListener('touchstart', e => {
            const btn = e.target.closest('.preset-btn'); if (!btn) return;
            const action = btn.dataset.action, value = parseFloat(btn.dataset.value);
            const input = e.target.getElementById('valor-emprestimo');
            let currentValue = parseFloat(input.value) || 0;
            if (action === 'add') currentValue += value;
            else if (action === 'multiply') currentValue *= value;
            else if (action === 'clear') currentValue = 0;
            input.value = currentValue.toFixed(2);
            atualizarEstadoBotoes();
        });

        document.querySelector('.dias-pagamento-botoes').addEventListener('click', e => {
            const btn = e.target.closest('.btn-dia');
            if (btn) {
                estado.dadosCalculadora.diaPagamento = parseInt(btn.dataset.dia, 10);
                document.querySelectorAll('.btn-dia').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const hoje = new Date();
                let vencimento = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), estado.dadosCalculadora.diaPagamento));
                if (vencimento <= hoje) vencimento.setUTCMonth(vencimento.getUTCMonth() + 1);
                estado.dadosCalculadora.dataPrimeiroVencimento = vencimento;

                const diffDays = Math.ceil((vencimento - hoje) / 864e5);
                const infoVenc = getElem('info-vencimento');
                infoVenc.className = 'info-vencimento-box';
                if (diffDays <= 10) infoVenc.classList.add('near');
                else if (diffDays <= 20) infoVenc.classList.add('medium');
                else infoVenc.classList.add('far');
                infoVenc.innerHTML = `Primeiro vencimento em <b>${diffDays} dias</b> (${formatarData(vencimento)})`;
                infoVenc.classList.remove('hidden');
                atualizarEstadoBotoes();
            }
        });
        document.querySelector('.dias-pagamento-botoes').addEventListener('touchstart', e => {
            const btn = e.target.closest('.btn-dia');
            if (btn) {
                estado.dadosCalculadora.diaPagamento = parseInt(btn.dataset.dia, 10);
                document.querySelectorAll('.btn-dia').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const hoje = new Date();
                let vencimento = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), estado.dadosCalculadora.diaPagamento));
                if (vencimento <= hoje) vencimento.setUTCMonth(vencimento.getUTCMonth() + 1);
                estado.dadosCalculadora.dataPrimeiroVencimento = vencimento;

                const diffDays = Math.ceil((vencimento - hoje) / 864e5);
                const infoVenc = getElem('info-vencimento');
                infoVenc.className = 'info-vencimento-box';
                if (diffDays <= 10) infoVenc.classList.add('near');
                else if (diffDays <= 20) infoVenc.classList.add('medium');
                else infoVenc.classList.add('far');
                infoVenc.innerHTML = `Primeiro vencimento em <b>${diffDays} dias</b> (${formatarData(vencimento)})`;
                infoVenc.classList.remove('hidden');
                atualizarEstadoBotoes();
            }
        });

        ['valor-emprestimo', 'nome-completo-cliente', 'cpf-cliente', 'endereco-cliente'].forEach(id => {
            getElem(id).addEventListener('input', atualizarEstadoBotoes);
        });

        getElem('cpf-cliente').addEventListener('input', e => {
            let v = e.target.value.replace(/\D/g, '');
            v = v.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
            e.target.value = v;
        });

        getElem('aceito-contrato').addEventListener('change', atualizarEstadoBotoes);
        getElem('aceito-contrato').addEventListener('touchstart', () => {
            getElem('aceito-contrato').checked = !getElem('aceito-contrato').checked;
            atualizarEstadoBotoes();
        });
        getElem('btn-finalizar-whatsapp').addEventListener('click', compartilharWhatsApp);
        getElem('btn-finalizar-whatsapp').addEventListener('touchstart', compartilharWhatsApp);

        const themeToggle = getElem('theme-toggle-btn');
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            themeToggle.textContent = document.body.classList.contains('dark-mode') ? '☀️' : '🌙';
            localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
        });
        themeToggle.addEventListener('touchstart', () => {
            document.body.classList.toggle('dark-mode');
            themeToggle.textContent = document.body.classList.contains('dark-mode') ? '☀️' : '🌙';
            localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
        });

        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
            themeToggle.textContent = '☀️';
        }

        setupAdminPanel();
        mostrarEtapa(1);
    })();
});
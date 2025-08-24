document.addEventListener('DOMContentLoaded', () => {
    // Inicializa os serviços do Firebase que vamos usar
    const auth = firebase.auth();
    const db = firebase.firestore();
    const storage = firebase.storage(); // Serviço de armazenamento

    // Roteador: verifica qual página está ativa pelo título e chama a função correta
    if (document.title.includes('Clientes')) {
        handleGerenciadorPage(auth, db, storage);
    } else if (document.title.includes('Créditos')) {
        handleCreditosPage(auth, db);
    } else if (document.title.includes('Configurações')) {
        handleConfiguracoesPage(auth, db);
    } else if (document.body.contains(document.getElementById('loginForm'))) {
        handleLoginPage(auth);
    }

    // Inicializa a funcionalidade do menu em qualquer página que o tenha
    if (document.querySelector('.sidebar')) {
        initializeSidebar();
    }
});

// --- FUNÇÃO PARA CONTROLAR O MENU LATERAL ---
function initializeSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    const toggleButton = document.getElementById('sidebarToggle');
    if (!sidebar || !mainContent || !toggleButton) return;

    if (localStorage.getItem('sidebarState') === 'collapsed') {
        sidebar.classList.add('collapsed');
        mainContent.classList.add('expanded');
    }

    toggleButton.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('expanded');
        if (sidebar.classList.contains('collapsed')) {
            localStorage.setItem('sidebarState', 'collapsed');
        } else {
            localStorage.setItem('sidebarState', 'expanded');
        }
    });
}

// ==================================================================
// FUNÇÃO DA PÁGINA DE LOGIN
// ==================================================================
function handleLoginPage(auth) {
    const loginForm = document.getElementById('loginForm');
    const loginMessage = document.getElementById('loginMessage');
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = e.target.username.value;
        const password = e.target.password.value;
        loginMessage.textContent = 'Verificando...';
        auth.signInWithEmailAndPassword(email, password)
            .then(() => { window.location.href = 'gerenciador.html'; })
            .catch((error) => {
                loginMessage.textContent = 'E-mail ou senha inválidos.';
                console.error("Erro de autenticação:", error.message);
            });
    });
}

// ==================================================================
// FUNÇÃO PARA A PÁGINA DE CRÉDITOS
// ==================================================================
function handleCreditosPage(auth, db) {
    auth.onAuthStateChanged(user => { if (!user) { window.location.href = 'index.html'; } });
    const logoutButton = document.getElementById('logoutButton');
    logoutButton.addEventListener('click', () => { auth.signOut().then(() => { window.location.href = 'index.html'; }); });
    
    const saldoRef = db.collection('contabilidade').doc('saldoCreditos');
    const comprasCreditoCollection = db.collection('comprasCredito');
    const addCreditosForm = document.getElementById('addCreditosForm');
    const filtroMesInput = document.getElementById('filtroMes');
    
    let allCompras = [];
    let currentPage = 1;
    const rowsPerPage = 10;
    
    const hoje = new Date();
    filtroMesInput.value = `${hoje.getFullYear()}-${(hoje.getMonth() + 1).toString().padStart(2, '0')}`;

    filtroMesInput.addEventListener('change', () => {
        currentPage = 1;
        carregarDadosCreditos();
    });

    async function carregarDadosCreditos() {
        const saldoDoc = await saldoRef.get();
        document.getElementById('saldoCreditos').textContent = saldoDoc.exists ? saldoDoc.data().saldo : 0;

        const filtro = filtroMesInput.value;
        if (!filtro) return;
        const [anoFiltro, mesFiltro] = filtro.split('-').map(Number);
        const inicioMes = new Date(anoFiltro, mesFiltro - 1, 1);
        const fimMes = new Date(anoFiltro, mesFiltro, 0, 23, 59, 59);

        const query = comprasCreditoCollection.where('data', '>=', inicioMes).where('data', '<=', fimMes).orderBy("data", "desc");
        const comprasSnapshot = await query.get();
        
        allCompras = [];
        let creditosCompradosMes = 0;
        comprasSnapshot.forEach(doc => {
            const compra = doc.data();
            creditosCompradosMes += compra.quantidade;
            allCompras.push({ id: doc.id, ...compra });
        });
        
        document.getElementById('creditosCompradosMes').textContent = creditosCompradosMes;
        displayCreditosPage(currentPage);
    }

    function displayCreditosPage(page) {
        currentPage = page;
        const tbody = document.getElementById('comprasTbody');
        tbody.innerHTML = '';
        const paginatedItems = allCompras.slice((page - 1) * rowsPerPage, page * rowsPerPage);

        if (paginatedItems.length === 0 && page === 1) {
             tbody.innerHTML = '<tr><td colspan="3">Nenhuma compra registrada para este mês.</td></tr>';
        } else {
            paginatedItems.forEach(compra => {
                const tr = document.createElement('tr');
                tr.dataset.id = compra.id;
                tr.dataset.quantidade = compra.quantidade;
                const dataCompra = compra.data.toDate().toLocaleDateString('pt-BR');
                tr.innerHTML = `
                    <td>${dataCompra}</td>
                    <td>${compra.quantidade}</td>
                    <td class="actions-cell">
                        <div class="actions-menu-container">
                            <button class="kebab-button"><i class="fas fa-ellipsis-v"></i></button>
                            <div class="actions-dropdown">
                                <a href="#" class="dropdown-item edit btn-edit"><i class="fas fa-pencil-alt"></i> Editar</a>
                                <a href="#" class="dropdown-item delete btn-delete"><i class="fas fa-trash-alt"></i> Excluir</a>
                            </div>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
        setupPagination(allCompras.length, document.getElementById('paginationControls'), displayCreditosPage, document.getElementById('pageInfo'));
    }
    
    addCreditosForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const quantidade = parseInt(document.getElementById('quantidadeCreditos').value);
        const dataCompraStr = document.getElementById('dataCompra').value;
        if (isNaN(quantidade) || quantidade <= 0 || !dataCompraStr) return Toastify({ text: "Preencha todos os campos.", backgroundColor: "#dc3545" }).showToast();
        
        const dataCompra = new Date(dataCompraStr + 'T12:00:00');
        db.runTransaction(transaction => {
            return transaction.get(saldoRef).then(doc => {
                const saldoAtual = doc.exists ? doc.data().saldo : 0;
                transaction.set(saldoRef, { saldo: saldoAtual + quantidade });
                comprasCreditoCollection.add({ quantidade, data: dataCompra });
            });
        }).then(() => {
            Toastify({ text: `${quantidade} créditos adicionados!`, backgroundColor: "#28a745" }).showToast();
            addCreditosForm.reset();
            carregarDadosCreditos();
        });
    });

    document.getElementById('comprasTbody').addEventListener('click', (e) => {
        e.preventDefault();
        const target = e.target.closest('button, a');
        if (!target) return;
        
        if (target.classList.contains('kebab-button')) {
            document.querySelectorAll('.actions-dropdown.show').forEach(dropdown => {
                if (dropdown !== target.nextElementSibling) dropdown.classList.remove('show');
            });
            target.nextElementSibling.classList.toggle('show');
            return;
        }

        const tr = target.closest('tr');
        if (!tr || !tr.dataset.id) return;
        const compraId = tr.dataset.id;
        const quantidadeOriginal = parseInt(tr.dataset.quantidade);

        if (target.classList.contains('btn-delete')) {
            showConfirmModal('Excluir Compra', 'Tem a certeza? Esta ação irá subtrair os créditos do seu saldo total.', () => {
                db.runTransaction(transaction => {
                    return transaction.get(saldoRef).then(doc => {
                        const saldoAtual = doc.exists ? doc.data().saldo : 0;
                        transaction.set(saldoRef, { saldo: saldoAtual - quantidadeOriginal });
                        transaction.delete(comprasCreditoCollection.doc(compraId));
                    });
                }).then(() => {
                    Toastify({ text: "Registo de compra excluído!", backgroundColor: "#dc3545" }).showToast();
                    carregarDadosCreditos();
                });
            });
        }

        if (target.classList.contains('btn-edit')) {
            const cells = tr.querySelectorAll('td');
            tr.innerHTML = `<td>${cells[0].textContent}</td><td><input type="number" value="${quantidadeOriginal}" style="width: 80px;"></td><td class="actions-cell"><button class="btn-save"><i class="fas fa-save"></i> Salvar</button></td>`;
        }

        if (target.classList.contains('btn-save')) {
            const novaQuantidade = parseInt(tr.querySelector('input').value);
            if(isNaN(novaQuantidade) || novaQuantidade <= 0) return alert('Valor inválido');
            const diferenca = novaQuantidade - quantidadeOriginal;
            db.runTransaction(transaction => {
                return transaction.get(saldoRef).then(doc => {
                    const saldoAtual = doc.exists ? doc.data().saldo : 0;
                    transaction.set(saldoRef, { saldo: saldoAtual + diferenca });
                    transaction.update(comprasCreditoCollection.doc(compraId), { quantidade: novaQuantidade });
                });
            }).then(() => {
                Toastify({ text: "Registro atualizado!", backgroundColor: "#007bff" }).showToast();
                carregarDadosCreditos();
            });
        }
    });

    window.addEventListener('click', (e) => {
        if (!e.target.closest('.actions-menu-container')) {
            document.querySelectorAll('.actions-dropdown.show').forEach(dropdown => {
                dropdown.classList.remove('show');
            });
        }
    });

    carregarDadosCreditos();
}

// ==================================================================
// FUNÇÃO PARA A PÁGINA DE CONFIGURAÇÕES
// ==================================================================
function handleConfiguracoesPage(auth, db) {
    auth.onAuthStateChanged(user => { if (!user) { window.location.href = 'index.html'; } });
    const logoutButton = document.getElementById('logoutButton');
    logoutButton.addEventListener('click', () => { auth.signOut().then(() => { window.location.href = 'index.html'; }); });

    const configRef = db.collection('configuracoes').doc('valores');
    const configForm = document.getElementById('configForm');

    async function carregarConfiguracoes() {
        const doc = await configRef.get();
        if (doc.exists) {
            const configs = doc.data();
            document.getElementById('precoMensal').value = configs.precoMensal || 30;
            document.getElementById('precoTrimestral').value = configs.precoTrimestral || 90;
            document.getElementById('custoCredito').value = configs.custoCredito || 10;
        } else {
            document.getElementById('precoMensal').value = 30;
            document.getElementById('precoTrimestral').value = 90;
            document.getElementById('custoCredito').value = 10;
        }
    }

    configForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const novasConfiguracoes = {
            precoMensal: parseFloat(document.getElementById('precoMensal').value),
            precoTrimestral: parseFloat(document.getElementById('precoTrimestral').value),
            custoCredito: parseFloat(document.getElementById('custoCredito').value)
        };
        configRef.set(novasConfiguracoes).then(() => {
            Toastify({ text: "Configurações salvas com sucesso!", backgroundColor: "#28a745" }).showToast();
        }).catch(error => {
            console.error("Erro ao salvar configurações: ", error);
            Toastify({ text: "Erro ao salvar.", backgroundColor: "#dc3545" }).showToast();
        });
    });

    carregarConfiguracoes();
}

// ==================================================================
// FUNÇÃO DA PÁGINA DE CLIENTES (FINAL)
// ==================================================================
async function handleGerenciadorPage(auth, db, storage) {
    const clientesCollection = db.collection('clientes');
    const saldoRef = db.collection('contabilidade').doc('saldoCreditos');
    const configRef = db.collection('configuracoes').doc('valores');
    const logoutButton = document.getElementById('logoutButton');
    const addClienteForm = document.getElementById('addClienteForm');
    const clientesTbody = document.getElementById('clientesTbody');
    const searchInput = document.getElementById('searchInput');
    const planoSelect = document.getElementById('clientePlano');
    const valorInput = document.getElementById('valor');
    const filtroMesExtrato = document.getElementById('filtroMesExtrato');
    const btnDownloadExtrato = document.getElementById('btnDownloadExtrato');
    const editModal = document.getElementById('editModal');
    const closeModal = document.getElementById('closeModal');
    const editForm = document.getElementById('editForm');
    const historyModal = document.getElementById('historyModal');
    const closeHistoryModal = document.getElementById('closeHistoryModal');
    
    let allClientes = [];
    let filteredClientes = [];
    let currentPage = 1;
    const rowsPerPage = 10;
    let configs = { precoMensal: 30, precoTrimestral: 90, custoCredito: 10 };

    auth.onAuthStateChanged(async (user) => { 
        if (user) { 
            const configDoc = await configRef.get();
            if (configDoc.exists) {
                configs = configDoc.data();
            }
            await carregarClientes();
        } else { 
            window.location.href = 'index.html'; 
        } 
    });

    async function carregarClientes() {
        const snapshot = await clientesCollection.orderBy('nome').get();
        allClientes = [];
        snapshot.forEach(doc => {
            allClientes.push({ id: doc.id, ...doc.data() });
        });
        filteredClientes = [...allClientes];
        displayClientesPage(1);
    }

    function displayClientesPage(page) {
        currentPage = page;
        const tbody = document.getElementById('clientesTbody');
        tbody.innerHTML = '';
        
        let totalRecebido = 0, totalAtrasado = 0, totalPendente = 0, clientesPagos = 0;
        allClientes.forEach(cliente => {
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            const dataVencimentoObj = new Date(cliente.vencimento + 'T00:00:00');
            let statusExibido = cliente.status;
            if (dataVencimentoObj < hoje && cliente.status !== 'Pago') {
                statusExibido = 'Atrasado';
            }
            if (statusExibido === 'Pago') {
                clientesPagos++;
                if (cliente.valor) totalRecebido += parseFloat(cliente.valor);
            } else if (statusExibido === 'Pendente') {
                if (cliente.valor) totalPendente += parseFloat(cliente.valor);
            } else if (statusExibido === 'Atrasado') {
                if (cliente.valor) totalAtrasado += parseFloat(cliente.valor);
            }
        });
        const custoCreditosUsados = clientesPagos * configs.custoCredito;
        const lucroRealizado = totalRecebido - custoCreditosUsados;
        document.getElementById('totalClientes').textContent = allClientes.length;
        document.getElementById('totalRecebido').textContent = `R$ ${totalRecebido.toFixed(2)}`;
        document.getElementById('custoCreditos').textContent = `R$ ${custoCreditosUsados.toFixed(2)}`;
        document.getElementById('lucroRealizado').textContent = `R$ ${lucroRealizado.toFixed(2)}`;
        document.getElementById('totalAtrasado').textContent = `R$ ${totalAtrasado.toFixed(2)}`;
        document.getElementById('totalPendente').textContent = `R$ ${totalPendente.toFixed(2)}`;
        
        const paginatedItems = filteredClientes.slice((page - 1) * rowsPerPage, page * rowsPerPage);
        paginatedItems.forEach(clienteData => {
            const cliente = clienteData;
            const tr = document.createElement('tr');
            tr.dataset.id = cliente.id;
            tr.dataset.plano = cliente.plano;
            
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            const dataVencimentoObj = new Date(cliente.vencimento + 'T00:00:00');
            let statusExibido = cliente.status;
            let statusClass = '';
            if (dataVencimentoObj < hoje && cliente.status !== 'Pago') {
                statusExibido = 'Atrasado';
                tr.classList.add('vencimento-atrasado');
            } else {
                const diffTime = dataVencimentoObj - hoje;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays >= 0 && diffDays <= 5 && cliente.status !== 'Pago') {
                    tr.classList.add('vencimento-proximo');
                }
            }
            if (statusExibido === 'Pago') statusClass = 'status-pago';
            else if (statusExibido === 'Pendente') statusClass = 'status-pendente';
            else if (statusExibido === 'Atrasado') statusClass = 'status-atrasado';
            
            let botoesAcao = '';
            if (statusExibido === 'Atrasado' || statusExibido === 'Pendente') {
                botoesAcao = `<button class="btn-confirmar"><i class="fas fa-check"></i> Confirmar Pagamento</button>`;
            } else {
                botoesAcao = `
                    <div class="actions-menu-container">
                        <button class="kebab-button"><i class="fas fa-ellipsis-v"></i></button>
                        <div class="actions-dropdown">
                            <a href="#" class="dropdown-item history btn-history"><i class="fas fa-history"></i> Histórico</a>
                            <a href="#" class="dropdown-item edit btn-edit"><i class="fas fa-pencil-alt"></i> Editar</a>
                            <a href="#" class="dropdown-item delete btn-delete"><i class="fas fa-trash-alt"></i> Excluir</a>
                        </div>
                    </div>
                `;
            }

            let comprovanteHtml = 'N/A';
            if (cliente.comprovanteURL) {
                comprovanteHtml = `<a href="${cliente.comprovanteURL}" target="_blank" class="link-comprovante">Ver</a>`;
            }
            const dataVencimentoFormatada = dataVencimentoObj.toLocaleDateString("pt-BR", { timeZone: 'UTC' });
            tr.innerHTML = `<td>${cliente.nome}</td><td>${cliente.loginCliente || ''}</td><td>${cliente.plano || ''}</td><td>R$ ${cliente.valor}</td><td>${dataVencimentoFormatada}</td><td class="${statusClass}">${statusExibido}</td><td>${comprovanteHtml}</td><td class="actions-cell">${botoesAcao}</td>`;
            tbody.appendChild(tr);
        });
        setupPagination(filteredClientes.length, document.getElementById('paginationControls'), displayClientesPage, document.getElementById('pageInfo'));
    }
    
    logoutButton.addEventListener('click', () => { auth.signOut().then(() => { window.location.href = 'index.html'; }); });

    planoSelect.addEventListener('change', () => {
        const valoresPlanos = { 'mensal': configs.precoMensal, 'trimestral': configs.precoTrimestral };
        const planoSelecionado = planoSelect.value.toLowerCase().trim();
        if (valoresPlanos[planoSelecionado]) {
            valorInput.value = valoresPlanos[planoSelecionado];
        }
    });
    
    addClienteForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const novoCliente = {
            nome: document.getElementById('nomeCliente').value, loginCliente: document.getElementById('clienteLogin').value,
            plano: document.getElementById('clientePlano').value, valor: parseFloat(document.getElementById('valor').value),
            vencimento: document.getElementById('dataVencimento').value, status: document.getElementById('statusPagamento').value,
        };
        clientesCollection.add(novoCliente).then(() => {
            Toastify({ text: "Cliente adicionado com sucesso!", backgroundColor: "#28a745" }).showToast();
            addClienteForm.reset();
            carregarClientes();
        });
    });

    clientesTbody.addEventListener('click', async (e) => {
        e.preventDefault();
        const target = e.target.closest('button, a');
        if (!target) return;

        if (target.classList.contains('kebab-button')) {
            document.querySelectorAll('.actions-dropdown.show').forEach(dropdown => {
                if (dropdown !== target.nextElementSibling) dropdown.classList.remove('show');
            });
            target.nextElementSibling.classList.toggle('show');
            return;
        }
        
        const tr = target.closest('tr');
        if (!tr || !tr.dataset.id) return;
        const clienteId = tr.dataset.id;

        if (target.classList.contains('btn-history')) {
            const cliente = filteredClientes.find(c => c.id === clienteId);
            document.getElementById('historyModalClientName').textContent = cliente.nome;
            const historyTbody = document.getElementById('historyTbody');
            historyTbody.innerHTML = '<tr><td colspan="3">A carregar histórico...</td></tr>';
            historyModal.style.display = 'flex';
            const pagamentosRef = db.collection('clientes').doc(clienteId).collection('historicoPagamentos').orderBy('dataPagamento', 'desc');
            const snapshot = await pagamentosRef.get();
            if (snapshot.empty) {
                historyTbody.innerHTML = '<tr><td colspan="3">Nenhum pagamento registado.</td></tr>';
            } else {
                historyTbody.innerHTML = '';
                snapshot.forEach(doc => {
                    const pagamento = doc.data();
                    const trHist = document.createElement('tr');
                    trHist.innerHTML = `<td>${pagamento.dataPagamento.toDate().toLocaleDateString('pt-BR')}</td><td>${pagamento.plano}</td><td>R$ ${pagamento.valor.toFixed(2)}</td>`;
                    historyTbody.appendChild(trHist);
                });
            }
        }

        if (target.classList.contains('btn-confirmar')) {
            const planoCliente = tr.dataset.plano;
            const clienteDoc = await clientesCollection.doc(clienteId).get();
            const valorCliente = clienteDoc.data().valor;
            db.runTransaction(transaction => {
                return transaction.get(saldoRef).then(doc => {
                    const saldoAtual = doc.exists ? doc.data().saldo : 0;
                    if (saldoAtual <= 0) { throw new Error("Saldo de créditos insuficiente!"); }
                    transaction.set(saldoRef, { saldo: saldoAtual - 1 });
                    const novaDataVencimento = new Date();
                    if (planoCliente.toLowerCase().trim() === 'mensal') {
                        novaDataVencimento.setMonth(novaDataVencimento.getMonth() + 1);
                    } else if (planoCliente.toLowerCase().trim() === 'trimestral') {
                        novaDataVencimento.setMonth(novaDataVencimento.getMonth() + 3);
                    }
                    const dadosCliente = { status: 'Pago', vencimento: novaDataVencimento.toISOString().split('T')[0] };
                    transaction.update(clientesCollection.doc(clienteId), dadosCliente);
                    const novoPagamentoRef = clientesCollection.doc(clienteId).collection('historicoPagamentos').doc();
                    transaction.set(novoPagamentoRef, { dataPagamento: new Date(), valor: valorCliente, plano: planoCliente });
                });
            }).then(() => {
                Toastify({ text: "Pagamento confirmado! 1 crédito utilizado.", backgroundColor: "#28a745" }).showToast();
                carregarClientes();
            }).catch(error => {
                Toastify({ text: error.message, backgroundColor: "#dc3545" }).showToast();
            });
        }
        
        if (target.classList.contains('btn-delete')) {
            showConfirmModal('Excluir Cliente', 'Tem a certeza de que deseja excluir este cliente permanentemente?', () => {
                clientesCollection.doc(clienteId).delete().then(() => {
                    Toastify({ text: "Cliente excluído!", backgroundColor: "#dc3545" }).showToast();
                    carregarClientes();
                });
            });
        }
        
        if (target.classList.contains('btn-edit')) {
            const cliente = filteredClientes.find(c => c.id === clienteId);
            if (!cliente) return;
            document.getElementById('editClienteId').value = cliente.id;
            document.getElementById('editNomeCliente').value = cliente.nome;
            document.getElementById('editClienteLogin').value = cliente.loginCliente || '';
            document.getElementById('editClientePlano').value = cliente.plano;
            document.getElementById('editValor').value = cliente.valor;
            document.getElementById('editDataVencimento').value = cliente.vencimento;
            document.getElementById('editStatusPagamento').value = cliente.status;
            editModal.style.display = 'flex';
        }
    });

    closeModal.onclick = () => { editModal.style.display = 'none'; }
    window.onclick = (event) => { 
        if (event.target == editModal) { editModal.style.display = 'none'; }
        if (event.target == historyModal) { historyModal.style.display = 'none'; }
        if (!event.target.closest('.actions-menu-container')) {
            document.querySelectorAll('.actions-dropdown.show').forEach(dropdown => {
                dropdown.classList.remove('show');
            });
        }
    }
    closeHistoryModal.onclick = () => { historyModal.style.display = 'none'; }

    editForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const clienteId = document.getElementById('editClienteId').value;
        const fileInput = document.getElementById('editComprovante');
        const file = fileInput.files[0];
        const clienteAtualizado = {
            nome: document.getElementById('editNomeCliente').value, loginCliente: document.getElementById('editClienteLogin').value,
            plano: document.getElementById('editClientePlano').value, valor: parseFloat(document.getElementById('editValor').value),
            vencimento: document.getElementById('editDataVencimento').value, status: document.getElementById('editStatusPagamento').value
        };
        const saveUpdates = (comprovanteURL = null) => {
            if(comprovanteURL) {
                clienteAtualizado.comprovanteURL = comprovanteURL;
            }
            clientesCollection.doc(clienteId).update(clienteAtualizado).then(() => {
                Toastify({ text: "Cliente atualizado com sucesso!", backgroundColor: "#007bff" }).showToast();
                editModal.style.display = 'none';
                editForm.reset();
                carregarClientes();
            });
        };
        if (file) {
            const uploadTask = storage.ref(`comprovantes/${clienteId}/${file.name}`).put(file);
            uploadTask.on('state_changed', null, 
                (error) => { console.error("Erro no upload:", error); }, 
                () => {
                    uploadTask.snapshot.ref.getDownloadURL().then(downloadURL => {
                        saveUpdates(downloadURL);
                    });
                }
            );
        } else {
            saveUpdates();
        }
    });
}

// ==================================================================
// FUNÇÃO GENÉRICA PARA O MODAL DE CONFIRMAÇÃO
// ==================================================================
function showConfirmModal(title, message, onConfirm) {
    const confirmModal = document.getElementById('confirmModal');
    document.getElementById('confirmModalTitle').textContent = title;
    document.getElementById('confirmModalMessage').textContent = message;
    confirmModal.style.display = 'flex';

    const confirmButton = document.getElementById('confirmButton');
    const cancelButton = document.getElementById('cancelButton');

    const confirmHandler = () => {
        onConfirm();
        hide();
    };

    const hide = () => {
        confirmModal.style.display = 'none';
        confirmButton.removeEventListener('click', confirmHandler);
    };

    confirmButton.addEventListener('click', confirmHandler);
    cancelButton.addEventListener('click', hide);
    window.addEventListener('click', (event) => {
        if (event.target == confirmModal) {
            hide();
        }
    }, { once: true });
}

// ==================================================================
// FUNÇÃO GENÉRICA PARA CRIAR A PAGINAÇÃO
// ==================================================================
function setupPagination(totalItems, wrapper, displayFunction, infoWrapper) {
    wrapper.innerHTML = "";
    const rowsPerPage = 10;
    const pageCount = Math.ceil(totalItems / rowsPerPage);
    const currentPage = (wrapper.dataset.currentPage) ? parseInt(wrapper.dataset.currentPage) : 1;
    const startItem = (currentPage - 1) * rowsPerPage + 1;
    const endItem = Math.min(startItem + rowsPerPage - 1, totalItems);
    if (totalItems > 0) {
        infoWrapper.textContent = `Mostrando ${startItem} a ${endItem} de ${totalItems} registros`;
    } else {
        infoWrapper.textContent = '';
    }
    if (pageCount <= 1) return;
    const prevButton = document.createElement('button');
    prevButton.textContent = 'Anterior';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', () => {
        wrapper.dataset.currentPage = currentPage - 1;
        displayFunction(currentPage - 1);
    });
    wrapper.appendChild(prevButton);
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(pageCount, currentPage + 2);
    if (currentPage < 3) { endPage = Math.min(5, pageCount); }
    if (currentPage > pageCount - 2) { startPage = Math.max(1, pageCount - 4); }
    if (startPage > 1) {
        const firstBtn = document.createElement('button');
        firstBtn.textContent = '1';
        firstBtn.addEventListener('click', () => { wrapper.dataset.currentPage = 1; displayFunction(1); });
        wrapper.appendChild(firstBtn);
        if (startPage > 2) {
            const dots = document.createElement('button');
            dots.textContent = '...';
            dots.disabled = true;
            wrapper.appendChild(dots);
        }
    }
    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        if (i === currentPage) {
            btn.classList.add('active');
        }
        btn.addEventListener('click', () => {
            wrapper.dataset.currentPage = i;
            displayFunction(i);
        });
        wrapper.appendChild(btn);
    }
    if (endPage < pageCount) {
        if (endPage < pageCount - 1) {
            const dots = document.createElement('button');
            dots.textContent = '...';
            dots.disabled = true;
            wrapper.appendChild(dots);
        }
        const lastBtn = document.createElement('button');
        lastBtn.textContent = pageCount;
        lastBtn.addEventListener('click', () => { wrapper.dataset.currentPage = pageCount; displayFunction(pageCount); });
        wrapper.appendChild(lastBtn);
    }
    const nextButton = document.createElement('button');
    nextButton.textContent = 'Seguinte';
    nextButton.disabled = currentPage === pageCount;
    nextButton.addEventListener('click', () => {
        wrapper.dataset.currentPage = currentPage + 1;
        displayFunction(currentPage + 1);
    });
    wrapper.appendChild(nextButton);
}

// ==================================================================
// REGISTO DO SERVICE WORKER
// ==================================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('Service Worker registado com sucesso:', registration.scope);
    }).catch(error => {
      console.log('Falha no registo do Service Worker:', error);
    });
  });
}

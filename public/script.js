document.addEventListener('DOMContentLoaded', () => {
    // Inicializa os serviços do Firebase que vamos usar
    const auth = firebase.auth();
    const db = firebase.firestore();

    // Roteador: verifica qual página está ativa pelo título e chama a função correta
    if (document.title.includes('Clientes')) {
        handleGerenciadorPage(auth, db);
    } else if (document.title.includes('Créditos')) {
        handleCreditosPage(auth, db);
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

    if (!sidebar || !mainContent || !toggleButton) {
        return;
    }

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
            .then(() => {
                window.location.href = 'gerenciador.html';
            })
            .catch((error) => {
                loginMessage.textContent = 'E-mail ou senha inválidos.';
                console.error("Erro de autenticação:", error.message);
            });
    });
}

// ==================================================================
// FUNÇÃO PARA A PÁGINA DE CRÉDITOS (COM PAGINAÇÃO)
// ==================================================================
function handleCreditosPage(auth, db) {
    auth.onAuthStateChanged(user => {
        if (!user) { window.location.href = 'index.html'; }
    });

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
    const ano = hoje.getFullYear();
    const mes = (hoje.getMonth() + 1).toString().padStart(2, '0');
    filtroMesInput.value = `${ano}-${mes}`;

    filtroMesInput.addEventListener('change', () => {
        currentPage = 1;
        carregarDadosCreditos();
    });

    async function carregarDadosCreditos() {
        const saldoDoc = await saldoRef.get();
        const saldoAtual = saldoDoc.exists ? saldoDoc.data().saldo : 0;
        document.getElementById('saldoCreditos').textContent = saldoAtual;

        const filtro = filtroMesInput.value;
        if (!filtro) return;

        const anoFiltro = parseInt(filtro.split('-')[0]);
        const mesFiltro = parseInt(filtro.split('-')[1]);

        const inicioMes = new Date(anoFiltro, mesFiltro - 1, 1);
        const fimMes = new Date(anoFiltro, mesFiltro, 0, 23, 59, 59);

        let query = comprasCreditoCollection
            .where('data', '>=', inicioMes)
            .where('data', '<=', fimMes)
            .orderBy("data", "desc");

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

        const startIndex = (page - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const paginatedItems = allCompras.slice(startIndex, endIndex);

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
                    <td class="action-buttons">
                        <button class="btn-edit">Editar</button>
                        <button class="btn-delete">Excluir</button>
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

        if (isNaN(quantidade) || quantidade <= 0 || !dataCompraStr) {
            return Toastify({ text: "Preencha todos os campos corretamente.", backgroundColor: "#dc3545" }).showToast();
        }
        
        const dataCompra = new Date(dataCompraStr + 'T12:00:00');

        db.runTransaction(transaction => {
            return transaction.get(saldoRef).then(doc => {
                const saldoAtual = doc.exists ? doc.data().saldo : 0;
                const novoSaldo = saldoAtual + quantidade;
                transaction.set(saldoRef, { saldo: novoSaldo });
                
                comprasCreditoCollection.add({
                    quantidade: quantidade,
                    data: dataCompra
                });
            });
        }).then(() => {
            Toastify({ text: `${quantidade} créditos adicionados!`, backgroundColor: "#28a745" }).showToast();
            addCreditosForm.reset();
            carregarDadosCreditos();
        });
    });

    const comprasTbody = document.getElementById('comprasTbody');
    comprasTbody.addEventListener('click', (e) => {
        const target = e.target;
        const tr = target.closest('tr');
        if (!tr) return;
        
        const compraId = tr.dataset.id;
        const quantidadeOriginal = parseInt(tr.dataset.quantidade);

        if (target.classList.contains('btn-delete')) {
            if (confirm('Tem certeza? Esta ação também irá subtrair os créditos do seu saldo total.')) {
                db.runTransaction(transaction => {
                    return transaction.get(saldoRef).then(doc => {
                        const saldoAtual = doc.exists ? doc.data().saldo : 0;
                        const novoSaldo = saldoAtual - quantidadeOriginal;
                        transaction.set(saldoRef, { saldo: novoSaldo });
                        
                        const compraRef = comprasCreditoCollection.doc(compraId);
                        transaction.delete(compraRef);
                    });
                }).then(() => {
                    Toastify({ text: "Registro de compra excluído!", backgroundColor: "#dc3545" }).showToast();
                    carregarDadosCreditos();
                });
            }
        }

        if (target.classList.contains('btn-edit')) {
            const cells = tr.querySelectorAll('td');
            tr.innerHTML = `
                <td>${cells[0].textContent}</td>
                <td><input type="number" value="${quantidadeOriginal}" style="width: 80px;"></td>
                <td class="action-buttons"><button class="btn-save">Salvar</button></td>
            `;
        }

        if (target.classList.contains('btn-save')) {
            const novaQuantidade = parseInt(tr.querySelector('input').value);
            if(isNaN(novaQuantidade) || novaQuantidade <= 0) return alert('Valor inválido');

            const diferenca = novaQuantidade - quantidadeOriginal;

            db.runTransaction(transaction => {
                return transaction.get(saldoRef).then(doc => {
                    const saldoAtual = doc.exists ? doc.data().saldo : 0;
                    const novoSaldo = saldoAtual + diferenca;
                    transaction.set(saldoRef, { saldo: novoSaldo });

                    const compraRef = comprasCreditoCollection.doc(compraId);
                    transaction.update(compraRef, { quantidade: novaQuantidade });
                });
            }).then(() => {
                Toastify({ text: "Registro de compra atualizado!", backgroundColor: "#007bff" }).showToast();
                carregarDadosCreditos();
            });
        }
    });

    carregarDadosCreditos();
}

// ==================================================================
// FUNÇÃO DA PÁGINA DE CLIENTES (COM PAGINAÇÃO)
// ==================================================================
function handleGerenciadorPage(auth, db) {
    auth.onAuthStateChanged(user => { if (user) { carregarClientes(); } else { window.location.href = 'index.html'; } });
    const logoutButton = document.getElementById('logoutButton');
    logoutButton.addEventListener('click', () => { auth.signOut().then(() => { window.location.href = 'index.html'; }); });

    const addClienteForm = document.getElementById('addClienteForm');
    const clientesTbody = document.getElementById('clientesTbody');
    const searchInput = document.getElementById('searchInput');
    const planoSelect = document.getElementById('clientePlano');
    const valorInput = document.getElementById('valor');
    const valoresPlanos = { 'mensal': 30, 'trimestral': 90 };

    planoSelect.addEventListener('change', () => {
        const planoSelecionado = planoSelect.value.toLowerCase().trim();
        if (valoresPlanos[planoSelecionado]) {
            valorInput.value = valoresPlanos[planoSelecionado];
        }
    });

    const clientesCollection = db.collection('clientes');
    const saldoRef = db.collection('contabilidade').doc('saldoCreditos');

    let allClientes = [];
    let filteredClientes = [];
    let currentPage = 1;
    const rowsPerPage = 10;

    searchInput.addEventListener('keyup', () => {
        const searchTerm = searchInput.value.toLowerCase();
        filteredClientes = allClientes.filter(cliente => cliente.nome.toLowerCase().includes(searchTerm));
        currentPage = 1;
        displayClientesPage(currentPage);
    });

    async function carregarClientes() {
        const snapshot = await clientesCollection.orderBy('nome').get();
        allClientes = [];
        snapshot.forEach(doc => {
            allClientes.push({ id: doc.id, ...doc.data() });
        });
        filteredClientes = [...allClientes];
        displayClientesPage(1); // Sempre exibe a primeira página ao carregar
    }

    function displayClientesPage(page) {
        currentPage = page;
        const tbody = document.getElementById('clientesTbody');
        tbody.innerHTML = '';
        
        // Lógica do dashboard (calculada sobre a lista COMPLETA, não a paginada)
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
        const custoCreditosUsados = clientesPagos * 10;
        const lucroRealizado = totalRecebido - custoCreditosUsados;
        document.getElementById('totalClientes').textContent = allClientes.length;
        document.getElementById('totalRecebido').textContent = `R$ ${totalRecebido.toFixed(2)}`;
        document.getElementById('custoCreditos').textContent = `R$ ${custoCreditosUsados.toFixed(2)}`;
        document.getElementById('lucroRealizado').textContent = `R$ ${lucroRealizado.toFixed(2)}`;
        document.getElementById('totalAtrasado').textContent = `R$ ${totalAtrasado.toFixed(2)}`;
        document.getElementById('totalPendente').textContent = `R$ ${totalPendente.toFixed(2)}`;
        
        // Lógica de paginação (sobre a lista FILTRADA)
        const startIndex = (page - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const paginatedItems = filteredClientes.slice(startIndex, endIndex);

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
            }
            if (statusExibido === 'Pago') statusClass = 'status-pago';
            else if (statusExibido === 'Pendente') statusClass = 'status-pendente';
            else if (statusExibido === 'Atrasado') statusClass = 'status-atrasado';

            let botoesAcao = '';
            if (statusExibido === 'Atrasado' || statusExibido === 'Pendente') {
                botoesAcao = `<button class="btn-confirmar">Confirmar Pagamento</button>`;
            } else {
                botoesAcao = `<button class="btn-edit">Editar</button><button class="btn-delete">Excluir</button>`;
            }
            const dataVencimentoFormatada = dataVencimentoObj.toLocaleDateString("pt-BR", { timeZone: 'UTC' });
            tr.innerHTML = `<td>${cliente.nome}</td><td>${cliente.loginCliente || ''}</td><td>${cliente.plano || ''}</td><td>R$ ${cliente.valor}</td><td>${dataVencimentoFormatada}</td><td class="${statusClass}">${statusExibido}</td><td class="action-buttons">${botoesAcao}</td>`;
            tbody.appendChild(tr);
        });

        setupPagination(filteredClientes.length, document.getElementById('paginationControls'), displayClientesPage, document.getElementById('pageInfo'));
    }
    
    addClienteForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const novoCliente = {
            nome: document.getElementById('nomeCliente').value,
            loginCliente: document.getElementById('clienteLogin').value,
            plano: document.getElementById('clientePlano').value,
            valor: parseFloat(document.getElementById('valor').value),
            vencimento: document.getElementById('dataVencimento').value,
            status: document.getElementById('statusPagamento').value,
        };
        clientesCollection.add(novoCliente).then(() => {
            Toastify({ text: "Cliente adicionado com sucesso!", backgroundColor: "#28a745" }).showToast();
            addClienteForm.reset();
            carregarClientes();
        });
    });

    clientesTbody.addEventListener('click', (e) => {
        const target = e.target;
        const tr = target.closest('tr');
        if (!tr) return;
        const clienteId = tr.dataset.id;

        if (target.classList.contains('btn-confirmar')) {
            const planoCliente = tr.dataset.plano;
            db.runTransaction(transaction => {
                return transaction.get(saldoRef).then(doc => {
                    const saldoAtual = doc.exists ? doc.data().saldo : 0;
                    if (saldoAtual <= 0) { throw new Error("Saldo de créditos insuficiente!"); }
                    const novoSaldo = saldoAtual - 1;
                    transaction.set(saldoRef, { saldo: novoSaldo });
                    const novaDataVencimento = new Date();
                    if (planoCliente.toLowerCase().trim() === 'mensal') {
                        novaDataVencimento.setMonth(novaDataVencimento.getMonth() + 1);
                    } else if (planoCliente.toLowerCase().trim() === 'trimestral') {
                        novaDataVencimento.setMonth(novaDataVencimento.getMonth() + 3);
                    }
                    const dadosCliente = { status: 'Pago', vencimento: novaDataVencimento.toISOString().split('T')[0] };
                    const clienteRef = clientesCollection.doc(clienteId);
                    transaction.update(clienteRef, dadosCliente);
                });
            }).then(() => {
                Toastify({ text: "Pagamento confirmado! 1 crédito utilizado.", backgroundColor: "#28a745" }).showToast();
                carregarClientes();
            }).catch(error => {
                Toastify({ text: error.message, backgroundColor: "#dc3545" }).showToast();
            });
        }
        
        if (target.classList.contains('btn-delete')) {
            if (confirm('Tem certeza?')) {
                clientesCollection.doc(clienteId).delete().then(() => {
                    Toastify({ text: "Cliente excluído!", backgroundColor: "#dc3545" }).showToast();
                    carregarClientes();
                });
            }
        }
        
        if (target.classList.contains('btn-save')) {
            const inputs = tr.querySelectorAll('input, select');
            const clienteAtualizado = {
                nome: inputs[0].value, loginCliente: inputs[1].value, plano: inputs[2].value,
                valor: parseFloat(inputs[3].value), vencimento: inputs[4].value, status: inputs[5].value
            };
            clientesCollection.doc(clienteId).update(clienteAtualizado).then(() => {
                Toastify({ text: "Cliente atualizado com sucesso!", backgroundColor: "#007bff" }).showToast();
                carregarClientes();
            });
        }

        if (target.classList.contains('btn-edit')) {
            const cells = tr.querySelectorAll('td');
            const planoAtual = cells[2].textContent;
            const dataVencimento = new Date(cells[4].textContent.split('/').reverse().join('-')).toISOString().split('T')[0];
            tr.innerHTML = `<td><input type="text" value="${cells[0].textContent}"></td><td><input type="text" value="${cells[1].textContent}"></td><td><select><option value="Mensal" ${planoAtual === 'Mensal' ? 'selected' : ''}>Mensal</option><option value="Trimestral" ${planoAtual === 'Trimestral' ? 'selected' : ''}>Trimestral</option></select></td><td><input type="number" value="${cells[3].textContent.replace('R$ ', '')}"></td><td><input type="date" value="${dataVencimento}"></td><td><select><option value="Pendente" ${cells[5].textContent === 'Pendente' ? 'selected' : ''}>Pendente</option><option value="Pago" ${cells[5].textContent === 'Pago' ? 'selected' : ''}>Pago</option><option value="Atrasado" ${cells[5].textContent === 'Atrasado' ? 'selected' : ''}>Atrasado</option></select></td><td class="action-buttons"><button class="btn-save">Salvar</button></td>`;
        }
    });
}

// ==================================================================
// FUNÇÃO GENÉRICA PARA CRIAR A PAGINAÇÃO
// ==================================================================
function setupPagination(totalItems, wrapper, displayFunction, infoWrapper) {
    wrapper.innerHTML = "";
    const rowsPerPage = 10;
    const pageCount = Math.ceil(totalItems / rowsPerPage);
    // Corrigido para ler a página atual do wrapper, senão sempre volta para 1
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

    // Lógica para mostrar apenas alguns botões de página
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(pageCount, currentPage + 2);

    if (currentPage < 3) {
        endPage = Math.min(5, pageCount);
    }
    if (currentPage > pageCount - 2) {
        startPage = Math.max(1, pageCount - 4);
    }
    
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

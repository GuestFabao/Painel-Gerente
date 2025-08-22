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
        return; // Sai da função se os elementos não existirem
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
// FUNÇÃO PARA A PÁGINA DE CRÉDITOS (ATUALIZADA)
// ==================================================================
function handleCreditosPage(auth, db) {
    auth.onAuthStateChanged(user => { if (!user) { window.location.href = 'index.html'; } });
    const logoutButton = document.getElementById('logoutButton');
    logoutButton.addEventListener('click', () => { auth.signOut().then(() => { window.location.href = 'index.html'; }); });
    
    const saldoRef = db.collection('contabilidade').doc('saldoCreditos');
    const comprasCreditoCollection = db.collection('comprasCredito');
    const addCreditosForm = document.getElementById('addCreditosForm');
    
    async function carregarDadosCreditos() {
        const saldoDoc = await saldoRef.get();
        const saldoAtual = saldoDoc.exists ? saldoDoc.data().saldo : 0;
        document.getElementById('saldoCreditos').textContent = saldoAtual;

        const comprasSnapshot = await comprasCreditoCollection.orderBy("data", "desc").get();
        const comprasTbody = document.getElementById('comprasTbody');
        comprasTbody.innerHTML = '';
        if (comprasSnapshot.empty) {
            comprasTbody.innerHTML = '<tr><td colspan="2">Nenhuma compra registrada.</td></tr>';
        } else {
            comprasSnapshot.forEach(doc => {
                const compra = doc.data();
                const tr = document.createElement('tr');
                const dataCompra = compra.data.toDate().toLocaleDateString('pt-BR');
                tr.innerHTML = `<td>${dataCompra}</td><td>${compra.quantidade}</td>`;
                comprasTbody.appendChild(tr);
            });
        }
    }
    
    addCreditosForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const quantidade = parseInt(document.getElementById('quantidadeCreditos').value);
        if (isNaN(quantidade) || quantidade <= 0) {
            return Toastify({ text: "Por favor, insira uma quantidade válida.", backgroundColor: "#dc3545" }).showToast();
        }

        const custoTotalCompra = quantidade * 10;

        db.runTransaction(transaction => {
            return transaction.get(saldoRef).then(doc => {
                const saldoAtual = doc.exists ? doc.data().saldo : 0;
                const novoSaldo = saldoAtual + quantidade;
                transaction.set(saldoRef, { saldo: novoSaldo });
                
                comprasCreditoCollection.add({
                    quantidade: quantidade,
                    custo: custoTotalCompra,
                    data: new Date()
                });
            });
        }).then(() => {
            Toastify({ text: `${quantidade} créditos adicionados (Custo: R$ ${custoTotalCompra.toFixed(2)})`, backgroundColor: "#28a745" }).showToast();
            addCreditosForm.reset();
            carregarDadosCreditos();
        }).catch(error => console.error("Erro ao adicionar créditos:", error));
    });

    carregarDadosCreditos();
}

// ==================================================================
// FUNÇÃO DA PÁGINA DE CLIENTES (ATUALIZADA)
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

    async function carregarClientes() {
        clientesTbody.innerHTML = '<tr><td colspan="7">Carregando clientes...</td></tr>';
        
        const snapshot = await clientesCollection.orderBy('nome').get();
        clientesTbody.innerHTML = '';

        const totalClientes = snapshot.size;
        document.getElementById('totalClientes').textContent = totalClientes;

        let totalRecebido = 0, totalAtrasado = 0, totalPendente = 0, clientesPagos = 0;
        
        document.getElementById('totalRecebido').textContent = 'R$ 0.00';
        document.getElementById('custoCreditos').textContent = 'R$ 0.00';
        document.getElementById('lucroRealizado').textContent = 'R$ 0.00';
        document.getElementById('totalAtrasado').textContent = 'R$ 0.00';
        document.getElementById('totalPendente').textContent = 'R$ 0.00';

        if (snapshot.empty) {
            clientesTbody.innerHTML = '<tr><td colspan="7">Nenhum cliente cadastrado.</td></tr>';
            return;
        }

        snapshot.forEach(doc => {
            const cliente = doc.data();
            const tr = document.createElement('tr');
            tr.dataset.id = doc.id;
            tr.dataset.plano = cliente.plano;

            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            const dataVencimentoObj = new Date(cliente.vencimento + 'T00:00:00');
            
            let statusExibido = cliente.status;
            let statusClass = '';

            if (dataVencimentoObj < hoje && cliente.status !== 'Pago') {
                statusExibido = 'Atrasado';
            }

            if (statusExibido === 'Pago') {
                statusClass = 'status-pago';
                clientesPagos++;
                if (cliente.valor) totalRecebido += parseFloat(cliente.valor);
            } else if (statusExibido === 'Pendente') {
                statusClass = 'status-pendente';
                if (cliente.valor) totalPendente += parseFloat(cliente.valor);
            } else if (statusExibido === 'Atrasado') {
                statusClass = 'status-atrasado';
                if (cliente.valor) totalAtrasado += parseFloat(cliente.valor);
            }

            let botoesAcao = '';
            if (statusExibido === 'Atrasado' || statusExibido === 'Pendente') {
                botoesAcao = `<button class="btn-confirmar">Confirmar Pagamento</button>`;
            } else {
                botoesAcao = `<button class="btn-edit">Editar</button><button class="btn-delete">Excluir</button>`;
            }
            const dataVencimentoFormatada = dataVencimentoObj.toLocaleDateString("pt-BR", { timeZone: 'UTC' });
            tr.innerHTML = `<td>${cliente.nome}</td><td>${cliente.loginCliente || ''}</td><td>${cliente.plano || ''}</td><td>R$ ${cliente.valor}</td><td>${dataVencimentoFormatada}</td><td class="${statusClass}">${statusExibido}</td><td class="action-buttons">${botoesAcao}</td>`;
            clientesTbody.appendChild(tr);
        });

        const custoCreditosUsados = clientesPagos * 10;
        const lucroRealizado = totalRecebido - custoCreditosUsados;

        document.getElementById('totalRecebido').textContent = `R$ ${totalRecebido.toFixed(2)}`;
        document.getElementById('custoCreditos').textContent = `R$ ${custoCreditosUsados.toFixed(2)}`;
        document.getElementById('lucroRealizado').textContent = `R$ ${lucroRealizado.toFixed(2)}`;
        document.getElementById('totalAtrasado').textContent = `R$ ${totalAtrasado.toFixed(2)}`;
        document.getElementById('totalPendente').textContent = `R$ ${totalPendente.toFixed(2)}`;
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
            Toastify({ text: "Cliente adicionado com sucesso!", duration: 3000, gravity: "top", position: "right", backgroundColor: "#28a745" }).showToast();
            addClienteForm.reset();
            carregarClientes();
        }).catch(error => console.error("Erro ao adicionar cliente:", error));
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
                    if (saldoAtual <= 0) {
                        throw new Error("Saldo de créditos insuficiente!");
                    }

                    const novoSaldo = saldoAtual - 1;
                    transaction.set(saldoRef, { saldo: novoSaldo });

                    const novaDataVencimento = new Date();
                    if (planoCliente.toLowerCase().trim() === 'mensal') {
                        novaDataVencimento.setMonth(novaDataVencimento.getMonth() + 1);
                    } else if (planoCliente.toLowerCase().trim() === 'trimestral') {
                        novaDataVencimento.setMonth(novaDataVencimento.getMonth() + 3);
                    }
                    
                    const dadosCliente = {
                        status: 'Pago',
                        vencimento: novaDataVencimento.toISOString().split('T')[0]
                    };
                    const clienteRef = clientesCollection.doc(clienteId);
                    transaction.update(clienteRef, dadosCliente);
                });
            }).then(() => {
                Toastify({ text: "Pagamento confirmado! 1 crédito utilizado.", backgroundColor: "#28a745" }).showToast();
                carregarClientes();
            }).catch(error => {
                Toastify({ text: error.message, backgroundColor: "#dc3545" }).showToast();
                console.error("Erro ao confirmar pagamento:", error);
            });
        }
        
        if (target.classList.contains('btn-delete')) {
            if (confirm('Tem certeza?')) {
                clientesCollection.doc(clienteId).delete().then(() => {
                    Toastify({ text: "Cliente excluído!", duration: 3000, gravity: "top", position: "right", backgroundColor: "#dc3545" }).showToast();
                    carregarClientes();
                }).catch(error => console.error("Erro ao excluir cliente: ", error));
            }
        }
        
        if (target.classList.contains('btn-save')) {
            const inputs = tr.querySelectorAll('input, select');
            const clienteAtualizado = {
                nome: inputs[0].value,
                loginCliente: inputs[1].value,
                plano: inputs[2].value,
                valor: parseFloat(inputs[3].value),
                vencimento: inputs[4].value,
                status: inputs[5].value
            };
            clientesCollection.doc(clienteId).update(clienteAtualizado).then(() => {
                Toastify({ text: "Cliente atualizado com sucesso!", duration: 3000, gravity: "top", position: "right", backgroundColor: "#007bff" }).showToast();
                carregarClientes();
            }).catch(error => console.error("Erro ao atualizar cliente: ", error));
        }

        if (target.classList.contains('btn-edit')) {
            const cells = tr.querySelectorAll('td');
            const planoAtual = cells[2].textContent;
            const dataVencimento = new Date(cells[4].textContent.split('/').reverse().join('-')).toISOString().split('T')[0];
            tr.innerHTML = `<td><input type="text" value="${cells[0].textContent}"></td><td><input type="text" value="${cells[1].textContent}"></td><td><select><option value="Mensal" ${planoAtual === 'Mensal' ? 'selected' : ''}>Mensal</option><option value="Trimestral" ${planoAtual === 'Trimestral' ? 'selected' : ''}>Trimestral</option></select></td><td><input type="number" value="${cells[3].textContent.replace('R$ ', '')}"></td><td><input type="date" value="${dataVencimento}"></td><td><select><option value="Pendente" ${cells[5].textContent === 'Pendente' ? 'selected' : ''}>Pendente</option><option value="Pago" ${cells[5].textContent === 'Pago' ? 'selected' : ''}>Pago</option><option value="Atrasado" ${cells[5].textContent === 'Atrasado' ? 'selected' : ''}>Atrasado</option></select></td><td class="action-buttons"><button class="btn-save">Salvar</button></td>`;
        }
    });
}

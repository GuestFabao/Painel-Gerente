document.addEventListener('DOMContentLoaded', () => {
    // Inicializa os serviços do Firebase que vamos usar
    const auth = firebase.auth();
    const db = firebase.firestore();

    // Roteador: verifica em qual página estamos e chama a função correta
    if (document.body.contains(document.getElementById('loginForm'))) {
        handleLoginPage(auth);
    } else if (document.body.contains(document.querySelector('.gerenciador-container'))) {
        handleGerenciadorPage(auth, db);
    }
});

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
            .then((userCredential) => {
                window.location.href = 'gerenciador.html';
            })
            .catch((error) => {
                loginMessage.textContent = 'E-mail ou senha inválidos.';
                console.error("Erro de autenticação:", error.message);
            });
    });
}

// ==================================================================
// FUNÇÃO DA PÁGINA DO GERENCIADOR (VERSÃO FINAL E CORRIGIDA)
// ==================================================================
function handleGerenciadorPage(auth, db) {
    auth.onAuthStateChanged(user => {
        if (user) {
            carregarClientes();
        } else {
            window.location.href = 'index.html';
        }
    });

    const logoutButton = document.getElementById('logoutButton');
    logoutButton.addEventListener('click', () => {
        auth.signOut().then(() => {
            window.location.href = 'index.html';
        });
    });

    const addClienteForm = document.getElementById('addClienteForm');
    const clientesTbody = document.getElementById('clientesTbody');
    const searchInput = document.getElementById('searchInput');

    // --- LÓGICA PARA PREENCHER VALOR AUTOMATICAMENTE ---
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

    async function carregarClientes() {
        clientesTbody.innerHTML = '<tr><td colspan="7">Carregando clientes...</td></tr>';
        
        const snapshot = await clientesCollection.orderBy('nome').get();
        clientesTbody.innerHTML = '';

        // --- ATUALIZA O NOVO CARD COM O TOTAL DE CLIENTES ---
        const totalClientes = snapshot.size; // Pega o número total de documentos
        document.getElementById('totalClientes').textContent = totalClientes;
        // --- FIM DA ATUALIZAÇÃO DO NOVO CARD ---

        let totalRecebido = 0;
        let totalAtrasado = 0;
        let totalPendente = 0;
        let totalCarteira = 0;
        
        // Zera os outros cards do dashboard antes de recalcular
        document.getElementById('totalRecebido').textContent = 'R$ 0.00';
        document.getElementById('totalAtrasado').textContent = 'R$ 0.00';
        document.getElementById('totalPendente').textContent = 'R$ 0.00';
        document.getElementById('totalCarteira').textContent = 'R$ 0.00';

        if (snapshot.empty) {
            clientesTbody.innerHTML = '<tr><td colspan="7">Nenhum cliente cadastrado.</td></tr>';
            return;
        }

        snapshot.forEach(doc => {
            const cliente = doc.data();
            const tr = document.createElement('tr');
            tr.dataset.id = doc.id;
            tr.dataset.plano = cliente.plano;

            if (cliente.valor) {
                totalCarteira += parseFloat(cliente.valor);
            }

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

        // ATUALIZA OS OUTROS CARDS DO DASHBOARD
        document.getElementById('totalRecebido').textContent = `R$ ${totalRecebido.toFixed(2)}`;
        document.getElementById('totalAtrasado').textContent = `R$ ${totalAtrasado.toFixed(2)}`;
        document.getElementById('totalPendente').textContent = `R$ ${totalPendente.toFixed(2)}`;
        document.getElementById('totalCarteira').textContent = `R$ ${totalCarteira.toFixed(2)}`;
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
            alert('Cliente adicionado com sucesso!');
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
            if (!planoCliente) {
                alert("Erro: Plano do cliente não definido."); return;
            }
            const novaDataVencimento = new Date();
            if (planoCliente.toLowerCase().trim() === 'mensal') {
                novaDataVencimento.setMonth(novaDataVencimento.getMonth() + 1);
            } else if (planoCliente.toLowerCase().trim() === 'trimestral') {
                novaDataVencimento.setMonth(novaDataVencimento.getMonth() + 3);
            } else {
                 alert(`Plano "${planoCliente}" não reconhecido.`); return;
            }
            const dadosAtualizados = {
                status: 'Pago',
                vencimento: novaDataVencimento.toISOString().split('T')[0]
            };
            clientesCollection.doc(clienteId).update(dadosAtualizados).then(() => {
                alert('Pagamento confirmado e renovado com sucesso!');
                carregarClientes();
            });
        }

        if (target.classList.contains('btn-delete')) {
            if (confirm('Tem certeza?')) {
                clientesCollection.doc(clienteId).delete().then(() => {
                    alert('Cliente excluído!');
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
                alert('Cliente atualizado!');
                carregarClientes();
            }).catch(error => console.error("Erro ao atualizar cliente: ", error));
        }

        if (target.classList.contains('btn-edit')) {
            const cells = tr.querySelectorAll('td');
            const planoAtual = cells[2].textContent; // Pega o plano atual do cliente
            const dataVencimento = new Date(cells[4].textContent.split('/').reverse().join('-')).toISOString().split('T')[0];
            
            tr.innerHTML = `
                <td><input type="text" value="${cells[0].textContent}"></td>
                <td><input type="text" value="${cells[1].textContent}"></td>
                <td>
                    <select>
                        <option value="Mensal" ${planoAtual === 'Mensal' ? 'selected' : ''}>Mensal</option>
                        <option value="Trimestral" ${planoAtual === 'Trimestral' ? 'selected' : ''}>Trimestral</option>
                    </select>
                </td>
                <td><input type="number" value="${cells[3].textContent.replace('R$ ', '')}"></td>
                <td><input type="date" value="${dataVencimento}"></td>
                <td>
                    <select>
                        <option value="Pendente" ${cells[5].textContent === 'Pendente' ? 'selected' : ''}>Pendente</option>
                        <option value="Pago" ${cells[5].textContent === 'Pago' ? 'selected' : ''}>Pago</option>
                        <option value="Atrasado" ${cells[5].textContent === 'Atrasado' ? 'selected' : ''}>Atrasado</option>
                    </select>
                </td>
                <td class="action-buttons">
                    <button class="btn-save">Salvar</button>
                </td>
            `;
        }
    });
}
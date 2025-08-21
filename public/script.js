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
// FUNÇÃO DA PÁGINA DE LOGIN COM FIREBASE
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
                // Login bem sucedido! Redireciona para o gerenciador.
                window.location.href = 'gerenciador.html';
            })
            .catch((error) => {
                // Trata os erros de login
                loginMessage.textContent = 'E-mail ou senha inválidos.';
                console.error("Erro de autenticação:", error.message);
            });
    });
}

// ==================================================================
// FUNÇÃO DO GERENCIADOR COMPLETA COM FIREBASE E FIRESTORE
// ==================================================================
function handleGerenciadorPage(auth, db) {
    // Escutador que verifica o estado da autenticação em tempo real
    auth.onAuthStateChanged(user => {
        if (user) {
            // O usuário está logado, então carregamos os clientes.
            carregarClientes();
        } else {
            // Se não houver usuário logado, redireciona para o login.
            window.location.href = 'index.html';
        }
    });

    const logoutButton = document.getElementById('logoutButton');
    logoutButton.addEventListener('click', () => {
        auth.signOut().then(() => {
            // Logout bem sucedido
            window.location.href = 'index.html';
        });
    });

    const addClienteForm = document.getElementById('addClienteForm');
    const clientesTbody = document.getElementById('clientesTbody');
    const searchInput = document.getElementById('searchInput');

    // Referência para a nossa coleção 'clientes' no Firestore
    const clientesCollection = db.collection('clientes');

    async function carregarClientes() {
        clientesTbody.innerHTML = '<tr><td colspan="7">Carregando clientes...</td></tr>';
        
        const snapshot = await clientesCollection.orderBy('nome').get();
        clientesTbody.innerHTML = '';

        if (snapshot.empty) {
            clientesTbody.innerHTML = '<tr><td colspan="7">Nenhum cliente cadastrado.</td></tr>';
            return;
        }

        snapshot.forEach(doc => {
            const cliente = doc.data(); // Pega os dados do cliente (nome, plano, etc.)
            const tr = document.createElement('tr');
            tr.dataset.id = doc.id; // Armazena o ID único do Firestore na linha da tabela

            const dataVencimento = cliente.vencimento ? new Date(cliente.vencimento).toISOString().split('T')[0] : '';

            tr.innerHTML = `
                <td>${cliente.nome}</td>
                <td>${cliente.loginCliente || ''}</td>
                <td>${cliente.plano || ''}</td>
                <td>R$ ${cliente.valor}</td>
                <td>${new Date(dataVencimento).toLocaleDateString("pt-BR", { timeZone: 'UTC' })}</td>
                <td>${cliente.status}</td>
                <td class="action-buttons">
                    <button class="btn-edit">Editar</button>
                    <button class="btn-delete">Excluir</button>
                </td>
            `;
            clientesTbody.appendChild(tr);
        });
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
        
        // Adiciona um novo "documento" (cliente) na coleção
        clientesCollection.add(novoCliente).then(() => {
            alert('Cliente adicionado com sucesso!');
            addClienteForm.reset();
            carregarClientes();
        }).catch(error => {
            console.error("Erro ao adicionar cliente: ", error);
            alert("Ocorreu um erro ao adicionar o cliente.");
        });
    });

    clientesTbody.addEventListener('click', (e) => {
        const target = e.target;
        const tr = target.closest('tr');
        if (!tr) return;
        const clienteId = tr.dataset.id;

        // --- Ação de Excluir ---
        if (target.classList.contains('btn-delete')) {
            if (confirm('Tem certeza que deseja excluir este cliente?')) {
                // Deleta o documento do Firestore usando seu ID
                clientesCollection.doc(clienteId).delete().then(() => {
                    alert('Cliente excluído!');
                    carregarClientes();
                }).catch(error => console.error("Erro ao excluir cliente: ", error));
            }
        }
        
        // --- Ação de Salvar Edição ---
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
            // Atualiza o documento do Firestore usando seu ID
            clientesCollection.doc(clienteId).update(clienteAtualizado).then(() => {
                alert('Cliente atualizado!');
                carregarClientes();
            }).catch(error => console.error("Erro ao atualizar cliente: ", error));
        }

        // --- Ação de Editar (transforma a linha em inputs) ---
        if (target.classList.contains('btn-edit')) {
            const cells = tr.querySelectorAll('td');
            const dataVencimento = new Date(cells[4].textContent.split('/').reverse().join('-')).toISOString().split('T')[0];
            tr.innerHTML = `
                <td><input type="text" value="${cells[0].textContent}"></td>
                <td><input type="text" value="${cells[1].textContent}"></td>
                <td><input type="text" value="${cells[2].textContent}"></td>
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
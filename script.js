// Coloque a URL da sua API do Google Apps Script aqui
const API_URL = 'https://script.google.com/macros/s/AKfycbw9gW55lPmTOJv8XUeKUyGRDM9OEYzvJpZHHV-Co7R9NoC55TS3ut4KSCt1yIqgVAy2/exec';

document.addEventListener('DOMContentLoaded', () => {
    // Verifica em qual página estamos
    if (document.body.contains(document.getElementById('loginForm'))) {
        handleLoginPage();
    } else if (document.body.contains(document.querySelector('.gerenciador-container'))) {
        handleGerenciadorPage();
    }
});

function handleGerenciadorPage() {
    // Verifica se o usuário está logado
    if (sessionStorage.getItem('isLoggedIn') !== 'true') {
        window.location.href = 'index.html';
        return;
    }

    const logoutButton = document.getElementById('logoutButton');
    logoutButton.addEventListener('click', () => {
        sessionStorage.removeItem('isLoggedIn');
        window.location.href = 'index.html';
    });

    const addClienteForm = document.getElementById('addClienteForm');
    const clientesTbody = document.getElementById('clientesTbody');

    // Função para buscar e exibir os clientes
    async function carregarClientes() {
        try {
            // Adiciona um feedback de carregamento
            clientesTbody.innerHTML = '<tr><td colspan="6">Carregando clientes...</td></tr>';

            const response = await fetch(`${API_URL}?action=getClientes`);
            const clientes = await response.json();

            clientesTbody.innerHTML = ''; // Limpa a tabela

            if (clientes.length === 0) {
                clientesTbody.innerHTML = '<tr><td colspan="6">Nenhum cliente cadastrado.</td></tr>';
                return;
            }

            clientes.forEach(cliente => {
                const tr = document.createElement('tr');
                tr.dataset.id = cliente.id; // Armazena o ID do cliente na linha

                let statusClass = '';
                if (cliente.status === 'Pago') statusClass = 'status-pago';
                if (cliente.status === 'Pendente') statusClass = 'status-pendente';
                if (cliente.status === 'Atrasado') statusClass = 'status-atrasado';

                // Formata a data para o formato YYYY-MM-DD para preencher o input type="date"
                const dataVencimento = cliente.vencimento ? new Date(cliente.vencimento).toISOString().split('T')[0] : '';

                tr.innerHTML = `
                    <td>${cliente.nome}</td>
                    <td>${cliente.plano}</td>
                    <td>R$ ${cliente.valor}</td>
                    <td>${new Date(dataVencimento).toLocaleDateString("pt-BR", { timeZone: 'UTC' })}</td>
                    <td class="${statusClass}">${cliente.status}</td>
                    <td class="action-buttons">
                        <button class="btn-edit">Editar</button>
                        <button class="btn-delete">Excluir</button>
                    </td>
                `;
                clientesTbody.appendChild(tr);
            });

        } catch (error) {
            console.error('Erro ao carregar clientes:', error);
            clientesTbody.innerHTML = '<tr><td colspan="6">Erro ao carregar os dados. Verifique sua conexão.</td></tr>';
        }
    }

    // Função para adicionar um novo cliente (sem alterações)
    addClienteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const novoCliente = {
            nome: document.getElementById('nomeCliente').value,
            plano: document.getElementById('plano').value,
            valor: document.getElementById('valor').value,
            vencimento: document.getElementById('dataVencimento').value,
            status: document.getElementById('statusPagamento').value,
            obs: document.getElementById('observacoes').value
        };

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'addCliente', data: novoCliente })
            });
            const result = await response.json();
            alert(result.message);
            addClienteForm.reset();
            carregarClientes();
        } catch (error) {
            console.error('Erro ao adicionar cliente:', error);
            alert('Falha ao adicionar cliente.');
        }
    });

    // --- NOVA LÓGICA PARA CLIQUES NA TABELA (EDITAR E EXCLUIR) ---
    clientesTbody.addEventListener('click', async (e) => {
        const target = e.target;
        const tr = target.closest('tr');
        const clienteId = tr.dataset.id;

        // --- AÇÃO DE EXCLUIR ---
        if (target.classList.contains('btn-delete')) {
            if (confirm('Tem certeza que deseja excluir este cliente?')) {
                try {
                    const response = await fetch(API_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                        body: JSON.stringify({ action: 'deleteCliente', id: clienteId })
                    });
                    const result = await response.json();
                    alert(result.message);
                    if (result.success) {
                        carregarClientes(); // Recarrega a lista
                    }
                } catch (error) {
                    console.error('Erro ao excluir cliente:', error);
                    alert('Falha ao excluir cliente.');
                }
            }
        }

        // --- AÇÃO DE EDITAR (transforma a linha em campos editáveis) ---
        if (target.classList.contains('btn-edit')) {
            const cells = tr.querySelectorAll('td');
            const dataVencimento = new Date(cells[3].textContent.split('/').reverse().join('-')).toISOString().split('T')[0];

            tr.innerHTML = `
                <td><input type="text" value="${cells[0].textContent}"></td>
                <td><input type="text" value="${cells[1].textContent}"></td>
                <td><input type="number" value="${cells[2].textContent.replace('R$ ', '')}"></td>
                <td><input type="date" value="${dataVencimento}"></td>
                <td>
                    <select>
                        <option value="Pendente" ${cells[4].textContent === 'Pendente' ? 'selected' : ''}>Pendente</option>
                        <option value="Pago" ${cells[4].textContent === 'Pago' ? 'selected' : ''}>Pago</option>
                        <option value="Atrasado" ${cells[4].textContent === 'Atrasado' ? 'selected' : ''}>Atrasado</option>
                    </select>
                </td>
                <td class="action-buttons">
                    <button class="btn-save">Salvar</button>
                </td>
            `;
        }

        // --- AÇÃO DE SALVAR (envia os dados editados) ---
        if (target.classList.contains('btn-save')) {
            const inputs = tr.querySelectorAll('input, select');
            const clienteAtualizado = {
                id: clienteId,
                nome: inputs[0].value,
                plano: inputs[1].value,
                valor: inputs[2].value,
                vencimento: inputs[3].value,
                status: inputs[4].value,
                obs: '' // Você pode adicionar um campo para observações se quiser
            };

            try {
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({ action: 'editCliente', data: clienteAtualizado })
                });
                const result = await response.json();
                alert(result.message);
                if (result.success) {
                    carregarClientes();
                }
            } catch (error) {
                console.error('Erro ao salvar cliente:', error);
                alert('Falha ao salvar alterações.');
            }
        }
    });

    // Carrega os clientes assim que a página é carregada
    carregarClientes();
}
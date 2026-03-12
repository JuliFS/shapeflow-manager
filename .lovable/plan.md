

## 3D Print Manager — SaaS Completo

### Visão Geral
Sistema de gestão para negócios de impressão e modelagem 3D com backend Supabase, autenticação, tema claro/escuro e geração de PDF.

---

### 1. Autenticação & Perfil
- Login/cadastro com email e senha
- Perfil do usuário com dados da empresa: nome, logo, endereço, telefone, email (usado nos PDFs)
- Página de recuperação de senha

### 2. Layout & Navegação
- **Sidebar** estilo Notion com ícones e labels: Dashboard, Clientes, Orçamentos, Pedidos, Financeiro, Estoque, Configurações
- **Toggle dark/light mode** no header
- Design clean inspirado em Notion/Stripe/Apple com tipografia moderna e espaçamento generoso

### 3. Dashboard
- Cards com KPIs: faturamento mensal, lucro mensal, pedidos em produção, orçamentos pendentes
- Gráfico de faturamento mensal (Recharts)
- Lista rápida de pedidos recentes e orçamentos pendentes

### 4. Módulo de Clientes
- CRUD completo: nome, telefone, email, empresa, observações
- Tabela com busca e paginação
- Detalhe do cliente com histórico de orçamentos/pedidos

### 5. Configurações (Impressoras, Materiais, Softwares)
- **Impressoras**: cadastro com nome, custo, vida útil, consumo energético, manutenção. Cálculo automático do custo/hora
- **Materiais/Filamentos**: material, cor, marca, custo/kg, densidade
- **Softwares**: nome, custo mensal, categoria

### 6. Estoque de Filamento
- Controle com material, peso inicial, peso restante
- Redução automática do peso ao registrar impressão
- Indicadores visuais de estoque baixo

### 7. Calculadora de Impressão 3D / Orçamentos
- Formulário: cliente, peça, impressora, material, peso, tempo, acabamento, pós-processamento, modelagem
- **Cálculos automáticos em tempo real**:
  - Custo material, custo máquina, custo trabalho, custo modelagem
  - Custo total e preço final com margem configurável
- Número único formato DDMMAAAAHHMM
- Status: rascunho → enviado → aprovado → recusado
- Upload de arquivo STL (Supabase Storage)
- **Geração de PDF** premium com jsPDF: logo, dados do orçamento, preço final em destaque, prazo, pagamento, rodapé

### 8. Pedidos
- Criados automaticamente quando orçamento é aprovado
- Status de produção: fila → imprimindo → pós-processamento → finalizado → entregue
- Kanban ou tabela com filtros por status

### 9. Financeiro
- Registro de receitas e despesas: valor, data, tipo, descrição
- Receita automática ao entregar pedido
- Relatórios: faturamento mensal, lucro mensal, lucro por material, lucro por impressora (gráficos Recharts)

### 10. Backend (Supabase)
- Tabelas: profiles, clients, printers, materials, filament_stock, software, quotes, quote_files, orders, financial_records
- RLS por user_id em todas as tabelas
- Storage bucket para arquivos STL
- Triggers para criar perfil no signup e criar pedido ao aprovar orçamento


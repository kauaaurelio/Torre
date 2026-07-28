// Ordem de operação: conecta -> carrega base -> escreve -> dispara -> lê o
// resultado -> ajusta os freios. Espelha as unidades do escopo no CLAUDE.md.

export type IconeNav = 'qr' | 'contatos' | 'compose' | 'tape' | 'report' | 'settings';

export interface NavItem {
  href: string;
  label: string;
  icon: IconeNav;
}

export const navItems: NavItem[] = [
  { href: '/conexao', label: 'Conexão', icon: 'qr' },
  { href: '/contatos', label: 'Contatos', icon: 'contatos' },
  { href: '/nova-campanha', label: 'Nova campanha', icon: 'compose' },
  { href: '/fila', label: 'Fila', icon: 'tape' },
  { href: '/relatorio', label: 'Relatório', icon: 'report' },
  { href: '/configuracoes', label: 'Configurações', icon: 'settings' },
];

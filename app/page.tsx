import { redirect } from 'next/navigation';

// Antes de qualquer coisa, precisa haver sessão. A porta de entrada é a Conexão.
export default function Home() {
  redirect('/conexao');
}

import type { RouteObject } from 'react-router'
import { RotaProtegida } from './auth/RotaProtegida'
import { Layout } from './components/Layout'
import { Raiz } from './components/Raiz'
import { AcessoPage } from './pages/AcessoPage'
import { AdminIndisponivel, AdminPage } from './pages/AdminPage'
import { CadastroPage } from './pages/CadastroPage'
import { CarrocaPage } from './pages/CarrocaPage'
import { DiretorioPage } from './pages/DiretorioPage'
import { EmBrevePage } from './pages/EmBrevePage'
import { LocalPage } from './pages/LocalPage'
import { MapaPage } from './pages/MapaPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PassaportePage } from './pages/PassaportePage'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Raiz />,
    children: [
      // Públicas e fora do layout de abas
      { path: 'entrar', element: <AcessoPage /> },
      { path: 'criar-conta', element: <CadastroPage /> },

      // Painel administrativo: fora das abas (é desktop-first), carregado sob demanda e fora do
      // precache — o código dele não vai para o celular do turista. Quem não é admin volta ao
      // mapa.
      {
        path: 'admin/*',
        element: (
          <RotaProtegida perfis={['admin']} semPerfilVaiPara="/">
            <AdminPage />
          </RotaProtegida>
        ),
        errorElement: <AdminIndisponivel />,
      },

      {
        element: <Layout />,
        children: [
          // Públicas: consultar mapa e estabelecimentos não exige conta (PRD, seção 10)
          { index: true, element: <MapaPage /> },
          { path: 'local/:id', element: <LocalPage /> },
          { path: 'diretorio', element: <DiretorioPage /> },

          // Precisam de sessão
          {
            element: <RotaProtegida />,
            children: [
              { path: 'carroca', element: <CarrocaPage /> },
              { path: 'passaporte', element: <PassaportePage /> },
            ],
          },

          // Por perfil
          {
            element: <RotaProtegida perfis={['carrier']} />,
            children: [
              {
                path: 'carroceiro',
                element: (
                  <EmBrevePage
                    titulo="Painel do carroceiro"
                    frase="Receber, aceitar e recusar pedidos de carroça chega na S10."
                  />
                ),
              },
            ],
          },
          {
            element: <RotaProtegida perfis={['partner']} />,
            children: [
              {
                path: 'parceiro',
                element: (
                  <EmBrevePage
                    titulo="Painel do parceiro"
                    frase="Editar o perfil do seu estabelecimento (fotos, horários e serviços) chega entre a S7 e a S8."
                  />
                ),
              },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]
